#!/usr/bin/env python3
"""
Integration tests for the OVLM Bridge Server WebSocket API.

Usage:
    # Start the server first, then run:
    python tests/test_websocket.py

    # Or with pytest (needs pytest-asyncio):
    pytest tests/test_websocket.py -v
"""

import asyncio
import json
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'server'))

import websockets

SERVER_URL = os.getenv("TEST_SERVER_URL", "ws://localhost:8765")
TIMEOUT = 10  # seconds per test


# ── Helpers ────────────────────────────────────────────────────────────────────

async def recv_json(ws, timeout=TIMEOUT):
    """Receive a single JSON message with timeout."""
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def send_json(ws, payload: dict):
    await ws.send(json.dumps(payload))


def check(condition, description):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {description}")
    if not condition:
        raise AssertionError(description)


# ── Test Cases ─────────────────────────────────────────────────────────────────

async def test_connection_established():
    """Server should send connection_established on connect."""
    print("\n[TEST] Connection Established")
    async with websockets.connect(SERVER_URL) as ws:
        msg = await recv_json(ws)
        check(msg["type"] == "connection_established", "type == connection_established")
        check("message" in msg, "message field present")
        check("timestamp" in msg, "timestamp field present")
        check(msg.get("server_status") == "ready", "server_status == ready")
    print("  -> OK")


async def test_sample_once():
    """sample_once should return an ovlm_analysis message."""
    print("\n[TEST] Sample Once")
    async with websockets.connect(SERVER_URL) as ws:
        await recv_json(ws)  # consume welcome
        await send_json(ws, {"type": "sample_once"})
        msg = await recv_json(ws)
        check(msg["type"] == "ovlm_analysis", "type == ovlm_analysis")
        check("analysis_id" in msg, "analysis_id present")
        check("natural_language_summary" in msg, "natural_language_summary present")
        check(len(msg["natural_language_summary"]) > 10, "summary is non-trivial")

        actions = msg.get("device_actions", {})
        check("activate_filter" in actions, "device_actions.activate_filter present")
        check("fan_speed" in actions, "device_actions.fan_speed present")
        check(0 <= actions["fan_speed"] <= 100, "fan_speed in valid range")

        metrics = msg.get("raw_metrics", {})
        check("air_quality_score" in metrics, "raw_metrics.air_quality_score present")
        check(0 <= metrics["air_quality_score"] <= 10, "air_quality_score in range 0–10")
        check("stress_confidence" in metrics, "raw_metrics.stress_confidence present")
        check(0.0 <= metrics["stress_confidence"] <= 1.0, "stress_confidence in range 0–1")
    print("  -> OK")


async def test_streaming_start_stop():
    """start_streaming / stop_streaming round-trip."""
    print("\n[TEST] Streaming Start/Stop")
    async with websockets.connect(SERVER_URL) as ws:
        await recv_json(ws)  # welcome

        await send_json(ws, {"type": "start_streaming"})
        started = await recv_json(ws)
        check(started["type"] == "streaming_started", "streaming_started received")

        await send_json(ws, {"type": "stop_streaming"})
        stopped = await recv_json(ws)
        check(stopped["type"] == "streaming_stopped", "streaming_stopped received")
    print("  -> OK")


async def test_custom_query():
    """custom_query should echo back a custom_response."""
    print("\n[TEST] Custom Query")
    query_text = "How is my air quality today?"
    async with websockets.connect(SERVER_URL) as ws:
        await recv_json(ws)  # welcome
        await send_json(ws, {"type": "custom_query", "query": query_text})
        msg = await recv_json(ws)
        check(msg["type"] == "custom_response", "type == custom_response")
        check(query_text in msg.get("message", ""), "query echoed in response")
    print("  -> OK")


async def test_invalid_json():
    """Server should not crash on invalid JSON."""
    print("\n[TEST] Invalid JSON Resilience")
    async with websockets.connect(SERVER_URL) as ws:
        await recv_json(ws)  # welcome
        await ws.send("this is not json {{{{")
        # Server should stay connected; request a sample to confirm
        await send_json(ws, {"type": "sample_once"})
        msg = await recv_json(ws)
        check(msg["type"] == "ovlm_analysis", "server still alive after bad JSON")
    print("  -> OK")


async def test_multiple_clients():
    """Multiple simultaneous clients should all receive broadcast messages."""
    print("\n[TEST] Multiple Clients Broadcast")
    async with (
        websockets.connect(SERVER_URL) as ws1,
        websockets.connect(SERVER_URL) as ws2,
    ):
        await recv_json(ws1)  # welcome
        await recv_json(ws2)  # welcome

        await send_json(ws1, {"type": "sample_once"})
        # Both clients should receive the analysis
        msg1 = await recv_json(ws1)
        msg2 = await recv_json(ws2)
        check(msg1["type"] == "ovlm_analysis", "client 1 received ovlm_analysis")
        check(msg2["type"] == "ovlm_analysis", "client 2 received ovlm_analysis")
        check(msg1["analysis_id"] == msg2["analysis_id"], "both clients got same analysis_id")
    print("  -> OK")


async def test_nl_summary_format():
    """Natural language summary should contain expected emoji markers."""
    print("\n[TEST] Natural Language Summary Format")
    async with websockets.connect(SERVER_URL) as ws:
        await recv_json(ws)
        await send_json(ws, {"type": "sample_once"})
        msg = await recv_json(ws)
        summary = msg.get("natural_language_summary", "")
        check("📊" in summary, "summary contains 📊 analysis marker")
        # Should contain one of the stress level markers
        has_stress = any(m in summary for m in ["✅", "🟡", "⚠️"])
        check(has_stress, "summary contains stress level marker")
        # Should contain one of the AQI markers
        has_aqi = any(m in summary for m in ["🌟", "😊", "😐", "😷"])
        check(has_aqi, "summary contains air quality marker")
    print("  -> OK")


# ── Runner ─────────────────────────────────────────────────────────────────────

TESTS = [
    test_connection_established,
    test_sample_once,
    test_streaming_start_stop,
    test_custom_query,
    test_invalid_json,
    test_multiple_clients,
    test_nl_summary_format,
]


async def run_all():
    print(f"Running OVLM Bridge Server integration tests against {SERVER_URL}")
    print("=" * 60)
    passed = failed = 0
    for test in TESTS:
        try:
            await test()
            passed += 1
        except Exception as exc:
            print(f"  -> FAILED: {exc}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    return failed == 0


if __name__ == "__main__":
    ok = asyncio.run(run_all())
    sys.exit(0 if ok else 1)
