#!/usr/bin/env python3
"""
Scentience → COLIP OVLM demo (olfaction-only, no vision)
Uses the existing BlueZ connection via D-Bus.
Ensure the device is connected first:  bluetoothctl connect 94:A9:90:38:37:11
Then run:  python3 demo.py
"""

import sys
import json
import signal
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv("server/.env")

import torch
from PIL import Image
from scentience.models import ColipModel
from transformers import CLIPTokenizer

import dbus
import dbus.mainloop.glib
from gi.repository import GLib

# ── D-Bus / BlueZ paths ────────────────────────────────────────────────────────
DEVICE_ADDRESS = os.environ.get("SCENTIENCE_DEVICE_ADDRESS", "94:A9:90:38:37:11")
DEVICE_PATH    = "/org/bluez/hci0/dev_" + DEVICE_ADDRESS.replace(":", "_")
CHAR_PATH      = DEVICE_PATH + "/service0028/char0029"

# ── Sensor → olfactory vector ──────────────────────────────────────────────────
# Ordered compound keys extracted from the device payload.
# Each reading is normalised to [0, 1] before being fed to the encoder.
SENSOR_KEYS = [
    "CO2",
    "NH3_A", "NH3_B",
    "NO_A",  "NO_B",
    "NO2_A", "NO2_B",
    "CO_A",  "CO_B",
    "H2_A",  "H2_B",
    "CH4_A", "CH4_B",
    "C2H5OH_A", "C2H5OH_B",
    "C3H8_A",   "C3H8_B",
    "C4H10_A",  "C4H10_B",
    "ENV_temperatureC", "ENV_humidity", "ENV_pressureHpa",
]
SENSOR_MAX = {
    "CO2": 5000.0,
    "NH3_A": 500.0,   "NH3_B": 500.0,
    "NO_A":  100.0,   "NO_B":  100.0,
    "NO2_A": 100.0,   "NO2_B": 100.0,
    "CO_A":  2000.0,  "CO_B":  2000.0,
    "H2_A":  1000.0,  "H2_B":  1000.0,
    "CH4_A": 10000.0, "CH4_B": 10000.0,
    "C2H5OH_A": 1000.0, "C2H5OH_B": 1000.0,
    "C3H8_A":   5000.0, "C3H8_B":   5000.0,
    "C4H10_A":  5000.0, "C4H10_B":  5000.0,
    "ENV_temperatureC": 60.0,
    "ENV_humidity":     100.0,
    "ENV_pressureHpa":  1100.0,
}
OLF_DIM = 112  # what the COLIP olfactory encoder expects


def make_olf_vec(data: dict) -> list:
    vec = []
    for k in SENSOR_KEYS:
        val = float(data.get(k, 0.0) or 0.0)
        vec.append(min(max(val / SENSOR_MAX.get(k, 1.0), 0.0), 1.0))
    # Pad remaining dims with zeros
    vec += [0.0] * (OLF_DIM - len(vec))
    return vec[:OLF_DIM]


# ── COLIP model + text anchors ─────────────────────────────────────────────────
# We run the full embed() with a neutral grey image so that the joint GNN
# embedding is in the same CLIP-aligned space as the text anchors, but the
# signal is driven almost entirely by the olfactory encoder.
BLANK_IMAGE = Image.new("RGB", (224, 224), (128, 128, 128))

# Aroma / environment categories shown to the consumer.
# Each entry: (display label, CLIP text description, whether to recommend filtering)
AROMA_ANCHORS = [
    ("Fresh air",          "fresh clean outdoor air, no pollutants, pure breathable",              False),
    ("Urban pollution",    "diesel exhaust fumes, nitrogen dioxide, carbon monoxide, traffic",      True),
    ("Cigarette smoke",    "cigarette tobacco smoke, burnt paper, nicotine fumes",                 True),
    ("Ammonia / cleaning", "ammonia bleach cleaning chemicals disinfectant",                       True),
    ("Cooking / kitchen",  "cooking food smells, kitchen fumes, frying oil, burnt food",           False),
    ("Mould / damp",       "mold mildew musty damp basement, fungal spores",                       True),
    ("Petrol / fuel",      "petrol gasoline fuel station, hydrocarbons, VOC solvent fumes",        True),
    ("Industrial / chemical", "industrial chemical factory, solvent, paint fumes, acetone",        True),
    ("Smoke / fire",       "wood smoke bonfire wildfire, burnt carbon particulates",               True),
    ("Floral / natural",   "floral perfume flowers garden, fresh natural botanical scent",         False),
]


def _get_image_features(clip_model, pixel_values):
    """transformers 5.x returns ModelOutput; unwrap to tensor."""
    out = clip_model.get_image_features(pixel_values=pixel_values)
    return out.pooler_output if hasattr(out, "pooler_output") else out


def load_model():
    print("Loading COLIP model (colip-small-base)...", flush=True)
    model = ColipModel.from_pretrained("colip-small-base", device="cpu")
    model._clip.eval()
    model._olf_encoder.eval()
    model._gnn.eval()

    tokenizer = CLIPTokenizer.from_pretrained("openai/clip-vit-base-patch32")

    labels      = [a[0] for a in AROMA_ANCHORS]
    descriptions = [a[1] for a in AROMA_ANCHORS]
    filter_flags = [a[2] for a in AROMA_ANCHORS]

    tokens = tokenizer(descriptions, padding=True, return_tensors="pt")
    with torch.no_grad():
        out = model._clip.get_text_features(**tokens)
        anchor_feats = out.pooler_output if hasattr(out, "pooler_output") else out
        anchor_feats = anchor_feats / anchor_feats.norm(dim=-1, keepdim=True)  # (10, 512)

    print("Model ready.\n", flush=True)
    return model, anchor_feats, labels, filter_flags


_TRANSFORM = None

def analyze(data: dict, model, anchor_feats, labels, filter_flags) -> dict:
    global _TRANSFORM
    if _TRANSFORM is None:
        from torchvision import transforms
        _TRANSFORM = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor()])

    olf_vec = make_olf_vec(data)
    olf_tensor = torch.tensor(olf_vec, dtype=torch.float32).unsqueeze(0).to(model.device)
    img_tensor = _TRANSFORM(BLANK_IMAGE).unsqueeze(0).to(model.device)

    with torch.no_grad():
        vision_emb = _get_image_features(model._clip, img_tensor)
        if model._vision_proj is not None:
            vision_emb = model._vision_proj(vision_emb)
        olf_emb = model._olf_encoder(olf_tensor)
        emb = model._gnn(vision_emb, olf_emb).squeeze()
        emb = emb / emb.norm()

        sims = (emb @ anchor_feats.T).tolist()   # cosine similarity to each anchor

    ranked = sorted(zip(sims, labels, filter_flags), reverse=True)
    return {
        "top":            ranked[:3],             # [(score, label, filter), ...]
        "filter_recommended": ranked[0][2],       # based on top match
        "raw_sims":       dict(zip(labels, sims)),
    }


# ── Terminal rendering ─────────────────────────────────────────────────────────
RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"
DIM    = "\033[2m"

def bar(score, width=20):
    """ASCII confidence bar for a cosine similarity score (roughly 0.2–0.35 range)."""
    lo, hi = 0.20, 0.36
    filled = int((score - lo) / (hi - lo) * width)
    filled = max(0, min(width, filled))
    return "█" * filled + "░" * (width - filled)


def render(data: dict, result: dict):
    ts   = datetime.now().strftime("%H:%M:%S")
    temp = data.get("ENV_temperatureC", 0)
    hum  = data.get("ENV_humidity", 0)
    batt = data.get("BATT_charge", "?")

    compound_keys = ["CO2", "NH3_A", "NH3_B", "NO_A", "NO2_A", "CO_A", "CO_B", "VOC"]
    compounds = "   ".join(f"{k}: {data[k]:.0f}" for k in compound_keys if k in data)

    top_score, top_label, top_filter = result["top"][0]
    color = RED if top_filter else GREEN

    filter_line = (
        f"{RED}{BOLD}⚠ Filter ON recommended{RESET}"
        if top_filter
        else f"{GREEN}{BOLD}✓ Air quality acceptable — filter not needed{RESET}"
    )

    lines = [
        "",
        f"{BOLD}{CYAN}─── Auracle Nose Ring  {ts} ───{RESET}",
        "",
        f"  {DIM}Environment{RESET}   {temp:.1f}°C   {hum:.1f}% RH   battery {batt}%",
        f"  {DIM}Sensors{RESET}       {compounds}",
        "",
        f"  {DIM}What you are breathing  [COLIP OVLM]{RESET}",
    ]

    for i, (score, label, filt) in enumerate(result["top"]):
        marker = "▶" if i == 0 else " "
        col    = (RED if filt else GREEN) if i == 0 else DIM
        lines.append(
            f"  {col}{marker} {label:<24}{RESET}  "
            f"{bar(score)}  {score:.4f}"
        )

    lines += [
        "",
        f"  {filter_line}",
        "",
        f"{BOLD}{CYAN}{'─' * 44}{RESET}",
    ]

    sys.stdout.write("\033[2J\033[H")
    sys.stdout.write("\n".join(lines) + "\n")
    sys.stdout.flush()


# ── D-Bus notification handler ─────────────────────────────────────────────────

_MODEL        = None
_ANCHOR_FEATS = None
_LABELS       = None
_FILTER_FLAGS = None


def on_properties_changed(interface, changed, invalidated):
    if interface != "org.bluez.GattCharacteristic1" or "Value" not in changed:
        return
    try:
        data = json.loads(bytes(changed["Value"]).decode("utf-8"))
    except Exception:
        print(f"[raw] {bytes(changed['Value']).hex()}", flush=True)
        return

    result = analyze(data, _MODEL, _ANCHOR_FEATS, _LABELS, _FILTER_FLAGS)
    render(data, result)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    global _MODEL, _ANCHOR_FEATS, _LABELS, _FILTER_FLAGS

    _MODEL, _ANCHOR_FEATS, _LABELS, _FILTER_FLAGS = load_model()

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()

    dev_props = dbus.Interface(
        bus.get_object("org.bluez", DEVICE_PATH),
        "org.freedesktop.DBus.Properties"
    )
    if not dev_props.Get("org.bluez.Device1", "Connected"):
        print(f"{RED}Device not connected. Run:{RESET}")
        print(f"  bluetoothctl connect {DEVICE_ADDRESS}")
        sys.exit(1)

    print(f"{GREEN}{BOLD}Device connected.{RESET} Subscribing to BLE notifications...")

    bus.add_signal_receiver(
        on_properties_changed,
        dbus_interface="org.freedesktop.DBus.Properties",
        signal_name="PropertiesChanged",
        path=CHAR_PATH,
    )

    char_iface = dbus.Interface(
        bus.get_object("org.bluez", CHAR_PATH),
        "org.bluez.GattCharacteristic1"
    )
    try:
        char_iface.StartNotify()
    except dbus.exceptions.DBusException as e:
        if "Already notifying" not in str(e):
            print(f"{RED}StartNotify failed: {e}{RESET}")
            sys.exit(1)

    print(f"{DIM}Streaming. Press Ctrl+C to stop.{RESET}\n")

    loop = GLib.MainLoop()

    def shutdown(sig, frame):
        print(f"\n{DIM}Stopping...{RESET}")
        try:
            char_iface.StopNotify()
        except Exception:
            pass
        loop.quit()

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    loop.run()


if __name__ == "__main__":
    main()
