#!/usr/bin/env bash
# setup.sh — One-time project setup for all components
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================================"
echo "  OVLM System Setup"
echo "============================================================"

# ── Python Server ────────────────────────────────────────────────────────────
echo ""
echo "[1/3] Setting up Python Bridge Server..."

VENV="$PROJECT_ROOT/server/.venv"
if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    echo "      Created virtual environment at server/.venv"
fi

source "$VENV/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$PROJECT_ROOT/server/requirements.txt"
echo "      Python dependencies installed."

if [ ! -f "$PROJECT_ROOT/server/.env" ]; then
    cp "$PROJECT_ROOT/server/.env.example" "$PROJECT_ROOT/server/.env"
    echo "      Created server/.env from example. Edit it to set your API keys."
fi

deactivate

# ── React Native ─────────────────────────────────────────────────────────────
echo ""
echo "[2/3] Setting up React Native app..."

RN_DIR="$PROJECT_ROOT/react-native"
if command -v node &>/dev/null; then
    cd "$RN_DIR"
    npm install --silent
    echo "      npm packages installed."

    if [ ! -f "$RN_DIR/.env" ]; then
        cp "$RN_DIR/.env.example" "$RN_DIR/.env"
        echo "      Created react-native/.env from example."
    fi
    cd "$PROJECT_ROOT"
else
    echo "      [SKIP] Node.js not found — install Node 18+ and run 'npm install' in react-native/"
fi

# ── iOS ──────────────────────────────────────────────────────────────────────
echo ""
echo "[3/3] iOS App..."
echo "      Source files are in ios/NoseFilterApp/"
echo "      To build: open ios/NoseFilterApp.xcodeproj in Xcode (macOS only)"
echo "      For physical device: update SERVER_HOST in ios/NoseFilterApp/Config.swift"

# ── Find local IP ─────────────────────────────────────────────────────────────
echo ""
echo "------------------------------------------------------------"
echo "  Your LAN IP (use for physical device connections):"
if command -v ipconfig &>/dev/null; then
    ipconfig getifaddr en0 2>/dev/null || echo "  (could not determine — check Network settings)"
elif command -v ip &>/dev/null; then
    ip route get 1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1); exit}' \
        || echo "  (could not determine)"
fi
echo "------------------------------------------------------------"
echo ""
echo "Setup complete! Run './scripts/start_dev.sh' to start the bridge server."
