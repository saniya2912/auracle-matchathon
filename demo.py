#!/usr/bin/env python3
"""
Scentience → OVLM demo
Uses the existing BlueZ connection via D-Bus — no separate BLE connect step needed.
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

import dbus
import dbus.mainloop.glib
from gi.repository import GLib

# ── D-Bus / BlueZ paths ────────────────────────────────────────────────────────
DEVICE_ADDRESS  = os.environ.get("SCENTIENCE_DEVICE_ADDRESS", "94:A9:90:38:37:11")
DEVICE_PATH     = "/org/bluez/hci0/dev_" + DEVICE_ADDRESS.replace(":", "_")
CHAR_PATH       = DEVICE_PATH + "/service0028/char0029"   # UUID 569a2000 (notify+read+write)

# ── OVLM analysis ──────────────────────────────────────────────────────────────
# TODO: replace with real model inference once the olfaction-only model is published

def analyze_hormone_indicators(data: dict) -> dict:
    nh3 = data.get("NH3", 0)
    co  = data.get("CO",  0)
    voc = data.get("VOC", 0)

    score = 0
    if nh3 > 250: score += 3
    elif nh3 > 150: score += 2
    elif nh3 > 100: score += 1
    if co > 1000: score += 2
    elif co > 500: score += 1
    if voc > 3000: score += 2
    elif voc > 2000: score += 1

    level = "high" if score >= 5 else "moderate" if score >= 3 else "low"
    return {
        "stress_level": level,
        "stress_score": score,
        "cortisol_confidence": min(score * 0.15, 0.95),
        "cortisol_estimate": f"{nh3 * 0.05:.1f} ng/m³",
    }


def analyze_air_quality(data: dict) -> dict:
    co2 = data.get("CO2", 400)
    no  = data.get("NO",  0)
    no2 = data.get("NO2", 0)
    voc = data.get("VOC", 0)

    aqi = 10
    if co2 > 1000: aqi -= 3
    elif co2 > 800: aqi -= 2
    elif co2 > 600: aqi -= 1
    if no > 15: aqi -= 2
    elif no > 10: aqi -= 1
    if no2 > 15: aqi -= 2
    elif no2 > 10: aqi -= 1
    if voc > 3000: aqi -= 3
    elif voc > 2000: aqi -= 2
    elif voc > 1000: aqi -= 1
    aqi = max(0, aqi)

    level = "excellent" if aqi >= 8 else "good" if aqi >= 6 else "moderate" if aqi >= 4 else "poor"
    return {"aqi": aqi, "level": level, "filtration_recommended": aqi < 6}

# ── Terminal rendering ─────────────────────────────────────────────────────────
RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"
DIM    = "\033[2m"

def stress_color(level):
    return GREEN if level == "low" else YELLOW if level == "moderate" else RED

def aqi_color(aqi):
    return GREEN if aqi >= 8 else YELLOW if aqi >= 4 else RED

def render(data: dict):
    hormone = analyze_hormone_indicators(data)
    air     = analyze_air_quality(data)

    ts   = datetime.now().strftime("%H:%M:%S")
    temp = data.get("ENV_temperatureC", 0)
    hum  = data.get("ENV_humidity", 0)
    batt = data.get("BATT_charge", "?")

    sc = stress_color(hormone["stress_level"])
    ac = aqi_color(air["aqi"])

    compound_keys = ["CO2", "NH3", "NO", "NO2", "CO", "VOC", "H2S", "HCHO", "C2H5OH"]
    compounds = "   ".join(f"{k}: {data[k]:.0f}" for k in compound_keys if k in data)

    stress = hormone["stress_level"]
    if stress == "high":
        nl = (f"⚠️  Elevated — cortisol proxy {hormone['cortisol_estimate']} "
              f"({hormone['cortisol_confidence']:.0%} conf). Stress-reduction filtration, 30 min.")
    elif stress == "moderate":
        nl = (f"🟡 Moderate — {hormone['cortisol_estimate']}. Standard filtration, 15 min.")
    else:
        nl = ("✅ Normal stress. " + (
            f"Air quality {air['level']} — no filtration needed."
            if not air["filtration_recommended"]
            else f"Air quality {air['level']} — light filtration recommended."))

    lines = [
        "",
        f"{BOLD}{CYAN}─── Scentience OVLM  {ts} ───{RESET}",
        "",
        f"  {DIM}Environment{RESET}   {temp:.1f}°C   {hum:.1f}% RH   battery {batt}%",
        f"  {DIM}Sensors{RESET}       {compounds}",
        "",
        f"  {DIM}Stress / cortisol{RESET}",
        f"    {sc}{BOLD}{hormone['stress_level'].upper()}{RESET}   "
        f"score {hormone['stress_score']}/10   "
        f"confidence {hormone['cortisol_confidence']:.0%}   "
        f"estimate {hormone['cortisol_estimate']}",
        "",
        f"  {DIM}Air quality{RESET}",
        f"    {ac}{BOLD}AQI {air['aqi']}/10  {air['level'].upper()}{RESET}   "
        f"filtration {'recommended' if air['filtration_recommended'] else 'not needed'}",
        "",
        f"  {DIM}Summary{RESET}",
        f"    {nl}",
        "",
        f"{BOLD}{CYAN}{'─' * 44}{RESET}",
    ]

    sys.stdout.write("\033[2J\033[H")
    sys.stdout.write("\n".join(lines) + "\n")
    sys.stdout.flush()

# ── Raw value decode ───────────────────────────────────────────────────────────

def decode_value(raw) -> dict | None:
    """Try JSON first; fall back to printing hex for debugging."""
    try:
        payload = bytes(raw)
        return json.loads(payload.decode("utf-8"))
    except Exception:
        print(f"[raw] {bytes(raw).hex()}", flush=True)
        return None

# ── D-Bus notification handler ─────────────────────────────────────────────────

def on_properties_changed(interface, changed, invalidated):
    if interface != "org.bluez.GattCharacteristic1":
        return
    if "Value" not in changed:
        return
    data = decode_value(changed["Value"])
    if data:
        render(data)
    elif changed["Value"]:
        # Got bytes but not JSON — print raw so we can diagnose the format
        print(f"[raw bytes] {bytes(changed['Value']).hex()}", flush=True)

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()

    # Verify device is connected
    dev_obj   = bus.get_object("org.bluez", DEVICE_PATH)
    dev_props = dbus.Interface(dev_obj, "org.freedesktop.DBus.Properties")
    connected = dev_props.Get("org.bluez.Device1", "Connected")
    if not connected:
        print(f"{RED}Device not connected. Run:{RESET}")
        print(f"  bluetoothctl connect {DEVICE_ADDRESS}")
        sys.exit(1)

    print(f"{GREEN}{BOLD}Device connected via BlueZ.{RESET} Subscribing to notifications...")

    # Subscribe to PropertiesChanged on the data characteristic
    char_obj = bus.get_object("org.bluez", CHAR_PATH)
    bus.add_signal_receiver(
        on_properties_changed,
        dbus_interface="org.freedesktop.DBus.Properties",
        signal_name="PropertiesChanged",
        path=CHAR_PATH,
        path_keyword=None,
    )

    # Start BLE notifications
    char_iface = dbus.Interface(char_obj, "org.bluez.GattCharacteristic1")
    try:
        char_iface.StartNotify()
    except dbus.exceptions.DBusException as e:
        if "Already notifying" not in str(e):
            print(f"{RED}StartNotify failed: {e}{RESET}")
            sys.exit(1)

    print(f"Streaming from {CHAR_PATH}")
    print(f"{DIM}Press Ctrl+C to stop.{RESET}\n")

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
