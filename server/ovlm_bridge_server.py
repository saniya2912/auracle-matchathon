#!/usr/bin/env python3
"""
Scentience OVLM Bridge Server
Connects Scentience BLE device + OVLM processing to iOS Nose Filter App via WebSocket
"""

import asyncio
import websockets
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Set
import uuid
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

load_dotenv()

import scentience as scn

# ── Logging setup ──────────────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.getenv("LOG_FILE", "ovlm_bridge.log")

handlers = [logging.StreamHandler()]
if LOG_FILE:
    handlers.append(
        RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3)
    )

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=handlers,
)
logger = logging.getLogger(__name__)


class OVLMProcessor:
    """
    Rule-based olfactory analysis.

    TODO: Replace analyze_hormone_indicators and analyze_air_quality with
    inference calls to the olfaction-only model once it is published on
    Hugging Face (vision encoder stripped, expected end of week).
    The natural_language_summary can then be driven by model output rather
    than the hand-coded scoring below.
    """

    def __init__(self):
        self.stress_compounds = ["NH3", "CO", "VOC"]
        self.air_quality_compounds = ["CO2", "NO", "NO2", "VOC"]

    async def analyze_hormone_indicators(self, sensor_data: Dict) -> Dict:
        nh3_level = sensor_data.get("NH3", 0)
        co_level = sensor_data.get("CO", 0)
        voc_level = sensor_data.get("VOC", 0)

        stress_score = 0
        if nh3_level > 250:
            stress_score += 3
        elif nh3_level > 150:
            stress_score += 2
        elif nh3_level > 100:
            stress_score += 1

        if co_level > 1000:
            stress_score += 2
        elif co_level > 500:
            stress_score += 1

        if voc_level > 3000:
            stress_score += 2
        elif voc_level > 2000:
            stress_score += 1

        return {
            "cortisol_indicators": {
                "nh3_level": nh3_level,
                "confidence": min(stress_score * 0.15, 0.95),
                "estimated_concentration": f"{nh3_level * 0.05:.1f} ng/m³",
            },
            "stress_level": (
                "high" if stress_score >= 5 else "moderate" if stress_score >= 3 else "low"
            ),
            "stress_score": stress_score,
            "compounds_detected": {
                "ammonia": nh3_level,
                "carbon_monoxide": co_level,
                "volatile_organics": voc_level,
            },
        }

    async def analyze_air_quality(self, sensor_data: Dict) -> Dict:
        co2 = sensor_data.get("CO2", 400)
        no = sensor_data.get("NO", 0)
        no2 = sensor_data.get("NO2", 0)
        voc = sensor_data.get("VOC", 0)

        aqi_score = 10

        if co2 > 1000:
            aqi_score -= 3
        elif co2 > 800:
            aqi_score -= 2
        elif co2 > 600:
            aqi_score -= 1

        if no > 15:
            aqi_score -= 2
        elif no > 10:
            aqi_score -= 1

        if no2 > 15:
            aqi_score -= 2
        elif no2 > 10:
            aqi_score -= 1

        if voc > 3000:
            aqi_score -= 3
        elif voc > 2000:
            aqi_score -= 2
        elif voc > 1000:
            aqi_score -= 1

        aqi_score = max(0, aqi_score)

        return {
            "air_quality_index": aqi_score,
            "quality_level": (
                "excellent"
                if aqi_score >= 8
                else "good"
                if aqi_score >= 6
                else "moderate"
                if aqi_score >= 4
                else "poor"
            ),
            "pollutants": {
                "carbon_dioxide": co2,
                "nitrogen_oxide": no,
                "nitrogen_dioxide": no2,
                "volatile_organics": voc,
            },
            "filtration_recommended": aqi_score < 6,
        }

    async def generate_natural_language_summary(
        self, hormone_analysis: Dict, air_quality: Dict, sensor_data: Dict
    ) -> str:
        timestamp = datetime.now().strftime("%H:%M")

        stress_level = hormone_analysis["stress_level"]
        cortisol_confidence = hormone_analysis["cortisol_indicators"]["confidence"]
        estimated_concentration = hormone_analysis["cortisol_indicators"]["estimated_concentration"]

        aqi = air_quality["air_quality_index"]
        quality_level = air_quality["quality_level"]
        filtration_needed = air_quality["filtration_recommended"]

        temp = sensor_data.get("ENV_temperatureC", 22)
        humidity = sensor_data.get("ENV_humidity", 45)

        parts = []
        parts.append(f"📊 Analysis at {timestamp}: {temp:.1f}°C, {humidity:.1f}% humidity.")

        if stress_level == "high":
            parts.append(
                f"⚠️ Elevated stress indicators detected! Cortisol markers suggest "
                f"{estimated_concentration} concentration ({cortisol_confidence:.0%} confidence)."
            )
        elif stress_level == "moderate":
            parts.append(
                f"🟡 Moderate stress levels observed. Cortisol indicators at "
                f"{estimated_concentration} ({cortisol_confidence:.0%} confidence)."
            )
        else:
            parts.append("✅ Stress levels appear normal. Low cortisol indicators detected.")

        quality_map = {
            "excellent": f"🌟 Air quality is excellent (AQI: {aqi}/10). No filtration needed.",
            "good": f"😊 Good air quality (AQI: {aqi}/10). Minimal pollutants detected.",
            "moderate": f"😐 Moderate air quality (AQI: {aqi}/10). Some pollutants present.",
            "poor": f"😷 Poor air quality (AQI: {aqi}/10). Multiple pollutants detected.",
        }
        parts.append(quality_map.get(quality_level, ""))

        if filtration_needed or stress_level in ["high", "moderate"]:
            if stress_level == "high":
                parts.append(
                    "🔧 Activating stress-response filtration mode. "
                    "Targeting ammonia and VOCs for 30 minutes."
                )
            else:
                parts.append("🔧 Activating standard air purification. Recommended duration: 15 minutes.")

        if stress_level == "high":
            parts.append("💡 Consider deep breathing exercises or taking a short break.")

        return " ".join(parts)


class OVLMBridgeServer:
    """WebSocket server bridging Scentience BLE device to iOS app"""

    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set = set()
        self.ovlm = OVLMProcessor()
        self.is_streaming = False
        self._streaming_interval = int(os.getenv("STREAMING_INTERVAL_SECONDS", "5"))

        api_key = os.environ["SCENTIENCE_API_KEY"]
        self._char_uuid = os.environ["SCENTIENCE_CHAR_UUID"]
        self.device = scn.ScentienceDevice(api_key=api_key)

    async def _connect_ble(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: self.device.connect_ble(char_uuid=self._char_uuid)
        )
        logger.info("BLE connection established (char_uuid=%s)", self._char_uuid)

    async def _sample_ble(self) -> Dict:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.device.sample_ble(**{"async": True})
        )

    # ── Client management ──────────────────────────────────────────────────────

    async def register_client(self, websocket):
        self.clients.add(websocket)
        logger.info("Client connected. Total: %d", len(self.clients))
        await websocket.send(
            json.dumps(
                {
                    "type": "connection_established",
                    "message": "🎉 Connected to OVLM Bridge Server. Ready to analyze olfactory data!",
                    "timestamp": datetime.now().isoformat(),
                    "server_status": "ready",
                }
            )
        )

    async def unregister_client(self, websocket):
        self.clients.discard(websocket)
        logger.info("Client disconnected. Total: %d", len(self.clients))

    async def broadcast_to_clients(self, message: Dict):
        if not self.clients:
            return
        payload = json.dumps(message)
        disconnected = set()
        for client in self.clients:
            try:
                await client.send(payload)
            except (websockets.exceptions.ConnectionClosed, Exception) as exc:
                logger.warning("Broadcast failed for client: %s", exc)
                disconnected.add(client)
        for client in disconnected:
            self.clients.discard(client)

    # ── Core analysis ──────────────────────────────────────────────────────────

    async def process_sensor_sample(self):
        try:
            sensor_data = await self._sample_ble()
            hormone_analysis = await self.ovlm.analyze_hormone_indicators(sensor_data)
            air_quality = await self.ovlm.analyze_air_quality(sensor_data)
            nl_summary = await self.ovlm.generate_natural_language_summary(
                hormone_analysis, air_quality, sensor_data
            )

            message = {
                "type": "ovlm_analysis",
                "analysis_id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "natural_language_summary": nl_summary,
                "device_actions": {
                    "activate_filter": (
                        air_quality["filtration_recommended"]
                        or hormone_analysis["stress_level"] != "low"
                    ),
                    "filter_mode": (
                        "stress_reduction"
                        if hormone_analysis["stress_level"] == "high"
                        else "standard"
                    ),
                    "duration_minutes": (
                        30 if hormone_analysis["stress_level"] == "high" else 15
                    ),
                    "alert_level": hormone_analysis["stress_score"],
                    "fan_speed": (
                        85 if hormone_analysis["stress_level"] == "high" else 65
                    ),
                },
                "raw_metrics": {
                    "stress_confidence": hormone_analysis["cortisol_indicators"]["confidence"],
                    "air_quality_score": air_quality["air_quality_index"],
                    "cortisol_estimate": hormone_analysis["cortisol_indicators"][
                        "estimated_concentration"
                    ],
                },
            }

            await self.broadcast_to_clients(message)
            logger.info("Sent OVLM analysis to %d clients", len(self.clients))

        except Exception as exc:
            logger.error("Error processing sensor sample: %s", exc)
            await self.broadcast_to_clients(
                {
                    "type": "error",
                    "message": f"OVLM processing error: {exc}",
                    "timestamp": datetime.now().isoformat(),
                }
            )

    # ── Message handling ───────────────────────────────────────────────────────

    async def handle_client_message(self, websocket, message: str):
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            logger.error("Invalid JSON from client: %.120s", message)
            return

        message_type = data.get("type")
        logger.debug("Received message type: %s", message_type)

        handlers = {
            "start_streaming": self._handle_start_streaming,
            "stop_streaming": self._handle_stop_streaming,
            "sample_once": self._handle_sample_once,
            "custom_query": self._handle_custom_query,
        }

        handler = handlers.get(message_type)
        if handler:
            await handler(websocket, data)
        else:
            logger.warning("Unknown message type: %s", message_type)

    async def _handle_start_streaming(self, websocket, data):
        self.is_streaming = True
        logger.info("Streaming started")
        await websocket.send(
            json.dumps(
                {
                    "type": "streaming_started",
                    "message": f"🔄 Real-time olfactory analysis started. Updates every {self._streaming_interval}s.",
                    "timestamp": datetime.now().isoformat(),
                }
            )
        )

    async def _handle_stop_streaming(self, websocket, data):
        self.is_streaming = False
        logger.info("Streaming stopped")
        await websocket.send(
            json.dumps(
                {
                    "type": "streaming_stopped",
                    "message": "⏸️ Real-time analysis paused.",
                    "timestamp": datetime.now().isoformat(),
                }
            )
        )

    async def _handle_sample_once(self, websocket, data):
        logger.info("Single sample requested")
        await self.process_sensor_sample()

    async def _handle_custom_query(self, websocket, data):
        query = data.get("query", "")
        logger.info("Custom query: %.80s", query)
        await websocket.send(
            json.dumps(
                {
                    "type": "custom_response",
                    "message": f"🤔 Processing your question: '{query}'. Custom OVLM analysis would appear here.",
                    "timestamp": datetime.now().isoformat(),
                }
            )
        )

    # ── Streaming loop ─────────────────────────────────────────────────────────

    async def streaming_loop(self):
        while True:
            if self.is_streaming and self.clients:
                await self.process_sensor_sample()
            await asyncio.sleep(self._streaming_interval)

    async def handle_client(self, websocket):
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed normally")
        except Exception as exc:
            logger.error("Unexpected client error: %s", exc)
        finally:
            await self.unregister_client(websocket)

    async def start_server(self):
        logger.info("Connecting to Scentience device via BLE...")
        await self._connect_ble()

        logger.info("Starting OVLM Bridge Server on %s:%d", self.host, self.port)
        asyncio.create_task(self.streaming_loop())

        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info("🚀 OVLM Bridge Server ready on ws://%s:%d", self.host, self.port)
            await asyncio.Future()  # Run forever


async def main():
    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "8765"))
    server = OVLMBridgeServer(host=host, port=port)
    await server.start_server()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
