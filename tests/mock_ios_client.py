#!/usr/bin/env python3
"""
Mock iOS client — simulates the SwiftUI NoseFilterApp for manual/integration testing.
Connects to the bridge server, prints received analyses, and optionally triggers streaming.

Usage:
    python tests/mock_ios_client.py                # single sample
    python tests/mock_ios_client.py --stream 20    # stream for 20 seconds
    python tests/mock_ios_client.py --query "How stressed am I?"
"""

import asyncio
import json
import sys
import os
import argparse
from datetime import datetime

import websockets

SERVER_URL = os.getenv("TEST_SERVER_URL", "ws://localhost:8765")


def pretty(msg: dict):
    t = msg.get("type", "unknown")
    ts = msg.get("timestamp", "")[:19] if msg.get("timestamp") else ""
    print(f"\n{'─'*60}")
    print(f"  Type      : {t}")
    if ts:
        print(f"  Timestamp : {ts}")

    if t == "ovlm_analysis":
        print(f"\n  📝 Summary:\n  {msg.get('natural_language_summary', '')}")
        da = msg.get("device_actions", {})
        print(f"\n  🔧 Device Actions:")
        print(f"     Filter active : {da.get('activate_filter')}")
        print(f"     Mode          : {da.get('filter_mode')}")
        print(f"     Fan speed     : {da.get('fan_speed')}%")
        print(f"     Duration      : {da.get('duration_minutes')} min")
        rm = msg.get("raw_metrics", {})
        print(f"\n  📊 Raw Metrics:")
        print(f"     Stress confidence : {rm.get('stress_confidence', 0):.0%}")
        print(f"     Air quality score : {rm.get('air_quality_score')}/10")
        print(f"     Cortisol estimate : {rm.get('cortisol_estimate')}")
    elif t in ("connection_established", "streaming_started", "streaming_stopped",
               "custom_response", "error"):
        print(f"  Message : {msg.get('message', '')}")
    print(f"{'─'*60}")


async def run(args):
    print(f"Connecting to {SERVER_URL} ...")
    async with websockets.connect(SERVER_URL) as ws:
        # Welcome
        pretty(json.loads(await ws.recv()))

        if args.query:
            await ws.send(json.dumps({"type": "custom_query", "query": args.query}))
            pretty(json.loads(await ws.recv()))

        elif args.stream is not None:
            duration = args.stream
            await ws.send(json.dumps({"type": "start_streaming"}))
            pretty(json.loads(await ws.recv()))
            deadline = asyncio.get_event_loop().time() + duration
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=7)
                    pretty(json.loads(raw))
                except asyncio.TimeoutError:
                    pass
            await ws.send(json.dumps({"type": "stop_streaming"}))
            pretty(json.loads(await ws.recv()))

        else:
            # Default: single sample
            await ws.send(json.dumps({"type": "sample_once"}))
            pretty(json.loads(await ws.recv()))

    print("\nDone.")


def main():
    parser = argparse.ArgumentParser(description="Mock iOS client for OVLM Bridge")
    parser.add_argument("--stream", type=int, metavar="SECONDS",
                        help="Stream for N seconds then stop")
    parser.add_argument("--query", type=str, help="Send a custom OVLM query")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
