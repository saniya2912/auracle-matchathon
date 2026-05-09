#!/usr/bin/env bash
# start_dev.sh — Start the OVLM Bridge Server for local development
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
VENV="$SERVER_DIR/.venv"

if [ ! -d "$VENV" ]; then
    echo "Virtual environment not found. Run './scripts/setup.sh' first."
    exit 1
fi

source "$VENV/bin/activate"

# Load .env if present
if [ -f "$SERVER_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$SERVER_DIR/.env"
    set +a
fi

echo "Starting OVLM Bridge Server..."
echo "  Host : ${SERVER_HOST:-0.0.0.0}"
echo "  Port : ${SERVER_PORT:-8765}"
echo "  Log  : ${LOG_FILE:-ovlm_bridge.log}"
echo "Press Ctrl+C to stop."
echo ""

cd "$SERVER_DIR"
python ovlm_bridge_server.py
