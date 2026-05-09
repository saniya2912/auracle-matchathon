#!/usr/bin/env bash
# test_integration.sh — Run integration tests against a running bridge server
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/server"
VENV="$SERVER_DIR/.venv"

SERVER_URL="${TEST_SERVER_URL:-ws://localhost:8765}"
START_SERVER="${START_SERVER:-0}"  # Set to 1 to auto-start server

SERVER_PID=""

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        echo ""
        echo "Stopping test server (PID $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# ── Optionally start the server ───────────────────────────────────────────────
if [ "$START_SERVER" = "1" ]; then
    echo "Auto-starting bridge server..."
    source "$VENV/bin/activate"
    [ -f "$SERVER_DIR/.env" ] && { set -a; source "$SERVER_DIR/.env"; set +a; }
    cd "$SERVER_DIR"
    python ovlm_bridge_server.py &
    SERVER_PID=$!
    echo "Server PID: $SERVER_PID"
    sleep 2  # Give server time to start
    cd "$PROJECT_ROOT"
fi

# ── Wait for server to be reachable ──────────────────────────────────────────
echo "Checking server at $SERVER_URL ..."
for i in $(seq 1 10); do
    if python3 -c "
import asyncio, websockets, sys
async def chk():
    try:
        async with websockets.connect('$SERVER_URL', open_timeout=2): pass
        return True
    except: return False
sys.exit(0 if asyncio.run(chk()) else 1)
" 2>/dev/null; then
        echo "Server is reachable."
        break
    fi
    if [ $i -eq 10 ]; then
        echo "ERROR: Server not reachable at $SERVER_URL after 10 attempts."
        echo "Start the server first with: ./scripts/start_dev.sh"
        echo "Or set START_SERVER=1 to auto-start."
        exit 1
    fi
    echo "  Waiting... ($i/10)"
    sleep 2
done

# ── Run tests ─────────────────────────────────────────────────────────────────
source "$VENV/bin/activate"
export TEST_SERVER_URL="$SERVER_URL"
python "$PROJECT_ROOT/tests/test_websocket.py"
