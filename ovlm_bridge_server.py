#!/usr/bin/env python3
"""
Scentience OVLM Bridge Server
Connects Scentience sensor data + OVLM processing to iOS Nose Filter App via WebSocket
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import uuid

# Mock Scentience imports (replace with actual when available)
try:
    import scentience as scn
except ImportError:
    print("Scentience package not found - using mock data")
    scn = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MockScentienceDevice:
    """Mock Scentience device for testing"""
    
    async def sample(self, async_mode=True):
        """Simulate sensor data"""
        import random
        return {
            "UID": "SCN001",
            "TIMESTAMP": datetime.now().isoformat(),
            "ENV_temperatureC": 22 + random.uniform(-2, 2),
            "ENV_humidity": 45 + random.uniform(-10, 10),
            "ENV_pressureHpa": 1010 + random.uniform(-5, 5),
            "BATT_charge": 85,
            "CO2": 400 + random.uniform(-50, 100),
            "NH3": 200 + random.uniform(0, 300),  # Stress indicator
            "NO": random.uniform(0, 20),
            "NO2": random.uniform(0, 20),
            "CO": 800 + random.uniform(0, 800),
            "C2H5OH": random.uniform(0, 500),
            "H2": random.uniform(100, 200),
            "CH4": random.uniform(300, 500),
            "VOC": 2000 + random.uniform(0, 2000)  # Air quality indicator
        }

class OVLMProcessor:
    """OVLM Processing and Natural Language Generation"""
    
    def __init__(self):
        self.stress_compounds = ["NH3", "CO", "VOC"]
        self.air_quality_compounds = ["CO2", "NO", "NO2", "VOC"]
        
    async def analyze_hormone_indicators(self, sensor_data: Dict) -> Dict:
        """Analyze sensor data for stress hormone indicators"""
        
        # Stress hormone detection logic
        nh3_level = sensor_data.get("NH3", 0)
        co_level = sensor_data.get("CO", 0)
        voc_level = sensor_data.get("VOC", 0)
        
        # Calculate stress indicators
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
                "estimated_concentration": f"{nh3_level * 0.05:.1f} ng/m³"
            },
            "stress_level": "high" if stress_score >= 5 else "moderate" if stress_score >= 3 else "low",
            "stress_score": stress_score,
            "compounds_detected": {
                "ammonia": nh3_level,
                "carbon_monoxide": co_level,
                "volatile_organics": voc_level
            }
        }
    
    async def analyze_air_quality(self, sensor_data: Dict) -> Dict:
        """Analyze overall air quality"""
        
        co2 = sensor_data.get("CO2", 400)
        no = sensor_data.get("NO", 0)
        no2 = sensor_data.get("NO2", 0)
        voc = sensor_data.get("VOC", 0)
        
        # Air quality scoring
        aqi_score = 10  # Start with perfect score
        
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
            "quality_level": "excellent" if aqi_score >= 8 else "good" if aqi_score >= 6 else "moderate" if aqi_score >= 4 else "poor",
            "pollutants": {
                "carbon_dioxide": co2,
                "nitrogen_oxide": no,
                "nitrogen_dioxide": no2,
                "volatile_organics": voc
            },
            "filtration_recommended": aqi_score < 6
        }
    
    async def generate_natural_language_summary(self, hormone_analysis: Dict, air_quality: Dict, sensor_data: Dict) -> str:
        """Generate natural language summary for iOS app"""
        
        timestamp = datetime.now().strftime("%H:%M")
        
        # Hormone detection summary
        stress_level = hormone_analysis["stress_level"]
        cortisol_confidence = hormone_analysis["cortisol_indicators"]["confidence"]
        estimated_concentration = hormone_analysis["cortisol_indicators"]["estimated_concentration"]
        
        # Air quality summary
        aqi = air_quality["air_quality_index"]
        quality_level = air_quality["quality_level"]
        filtration_needed = air_quality["filtration_recommended"]
        
        # Environmental context
        temp = sensor_data.get("ENV_temperatureC", 22)
        humidity = sensor_data.get("ENV_humidity", 45)
        
        # Generate conversational summary
        summary_parts = []
        
        # Time and environmental context
        summary_parts.append(f"📊 Analysis at {timestamp}: {temp:.1f}°C, {humidity:.1f}% humidity.")
        
        # Hormone detection
        if stress_level == "high":
            summary_parts.append(f"⚠️ Elevated stress indicators detected! Cortisol markers suggest {estimated_concentration} concentration ({cortisol_confidence:.0%} confidence).")
        elif stress_level == "moderate":
            summary_parts.append(f"🟡 Moderate stress levels observed. Cortisol indicators at {estimated_concentration} ({cortisol_confidence:.0%} confidence).")
        else:
            summary_parts.append(f"✅ Stress levels appear normal. Low cortisol indicators detected.")
        
        # Air quality assessment
        if quality_level == "excellent":
            summary_parts.append(f"🌟 Air quality is excellent (AQI: {aqi}/10). No filtration needed.")
        elif quality_level == "good":
            summary_parts.append(f"😊 Good air quality (AQI: {aqi}/10). Minimal pollutants detected.")
        elif quality_level == "moderate":
            summary_parts.append(f"😐 Moderate air quality (AQI: {aqi}/10). Some pollutants present.")
        else:
            summary_parts.append(f"😷 Poor air quality (AQI: {aqi}/10). Multiple pollutants detected.")
        
        # Filtration recommendations
        if filtration_needed or stress_level in ["high", "moderate"]:
            if stress_level == "high":
                summary_parts.append("🔧 Activating stress-response filtration mode. Targeting ammonia and VOCs for 30 minutes.")
            else:
                summary_parts.append("🔧 Activating standard air purification. Recommended duration: 15 minutes.")
        
        # Health recommendations
        if stress_level == "high":
            summary_parts.append("💡 Consider deep breathing exercises or taking a short break.")
        
        return " ".join(summary_parts)

class OVLMBridgeServer:
    """WebSocket server bridging Scentience to iOS app"""
    
    def __init__(self, port: int = 8765):
        self.port = port
        self.clients = set()
        self.device = MockScentienceDevice() if scn is None else scn.ScentienceDevice(api_key="YOUR_API_KEY")
        self.ovlm = OVLMProcessor()
        self.is_streaming = False
        
    async def register_client(self, websocket):
        """Register a new iOS client"""
        self.clients.add(websocket)
        logger.info(f"iOS client connected. Total clients: {len(self.clients)}")
        
        # Send welcome message
        welcome_message = {
            "type": "connection_established",
            "message": "🎉 Connected to OVLM Bridge Server. Ready to analyze olfactory data!",
            "timestamp": datetime.now().isoformat(),
            "server_status": "ready"
        }
        await websocket.send(json.dumps(welcome_message))
    
    async def unregister_client(self, websocket):
        """Unregister a disconnected client"""
        self.clients.discard(websocket)
        logger.info(f"iOS client disconnected. Total clients: {len(self.clients)}")
    
    async def broadcast_to_clients(self, message: Dict):
        """Send message to all connected iOS clients"""
        if self.clients:
            disconnected = set()
            for client in self.clients:
                try:
                    await client.send(json.dumps(message))
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)
            
            # Remove disconnected clients
            for client in disconnected:
                self.clients.discard(client)
    
    async def process_sensor_sample(self):
        """Process a single sensor sample through OVLM"""
        try:
            # Get sensor data
            sensor_data = await self.device.sample(async_mode=True)
            
            # Process through OVLM
            hormone_analysis = await self.ovlm.analyze_hormone_indicators(sensor_data)
            air_quality = await self.ovlm.analyze_air_quality(sensor_data)
            
            # Generate natural language summary
            nl_summary = await self.ovlm.generate_natural_language_summary(
                hormone_analysis, air_quality, sensor_data
            )
            
            # Prepare message for iOS app
            message = {
                "type": "ovlm_analysis",
                "analysis_id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "natural_language_summary": nl_summary,
                "device_actions": {
                    "activate_filter": air_quality["filtration_recommended"] or hormone_analysis["stress_level"] != "low",
                    "filter_mode": "stress_reduction" if hormone_analysis["stress_level"] == "high" else "standard",
                    "duration_minutes": 30 if hormone_analysis["stress_level"] == "high" else 15,
                    "alert_level": hormone_analysis["stress_score"],
                    "fan_speed": 85 if hormone_analysis["stress_level"] == "high" else 65
                },
                "raw_metrics": {
                    "stress_confidence": hormone_analysis["cortisol_indicators"]["confidence"],
                    "air_quality_score": air_quality["air_quality_index"],
                    "cortisol_estimate": hormone_analysis["cortisol_indicators"]["estimated_concentration"]
                }
            }
            
            # Send to iOS clients
            await self.broadcast_to_clients(message)
            logger.info(f"Sent OVLM analysis to {len(self.clients)} iOS clients")
            
        except Exception as e:
            logger.error(f"Error processing sensor sample: {e}")
            error_message = {
                "type": "error",
                "message": f"OVLM processing error: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
            await self.broadcast_to_clients(error_message)
    
    async def handle_client_message(self, websocket, message: str):
        """Handle messages from iOS app"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "start_streaming":
                self.is_streaming = True
                logger.info("Started real-time streaming to iOS app")
                response = {
                    "type": "streaming_started",
                    "message": "🔄 Real-time olfactory analysis started. You'll receive updates every 5 seconds.",
                    "timestamp": datetime.now().isoformat()
                }
                await websocket.send(json.dumps(response))
                
            elif message_type == "stop_streaming":
                self.is_streaming = False
                logger.info("Stopped streaming to iOS app")
                response = {
                    "type": "streaming_stopped", 
                    "message": "⏸️ Real-time analysis paused.",
                    "timestamp": datetime.now().isoformat()
                }
                await websocket.send(json.dumps(response))
                
            elif message_type == "sample_once":
                logger.info("Processing single sample request from iOS app")
                await self.process_sensor_sample()
                
            elif message_type == "custom_query":
                query = data.get("query", "")
                logger.info(f"Custom query from iOS: {query}")
                # Process custom OVLM query
                custom_response = {
                    "type": "custom_response",
                    "message": f"🤔 Processing your question: '{query}'. Custom OVLM analysis would appear here.",
                    "timestamp": datetime.now().isoformat()
                }
                await websocket.send(json.dumps(custom_response))
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from client: {message}")
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
    
    async def streaming_loop(self):
        """Main streaming loop for real-time analysis"""
        while True:
            if self.is_streaming and self.clients:
                await self.process_sensor_sample()
            await asyncio.sleep(5)  # 5-second intervals
    
    async def handle_client(self, websocket, path):
        """Handle individual client connections"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed")
        finally:
            await self.unregister_client(websocket)
    
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"Starting OVLM Bridge Server on port {self.port}")
        
        # Start streaming loop
        streaming_task = asyncio.create_task(self.streaming_loop())
        
        # Start WebSocket server
        server = await websockets.serve(self.handle_client, "localhost", self.port)
        logger.info(f"🚀 OVLM Bridge Server ready! iOS app can connect to ws://localhost:{self.port}")
        
        await server.wait_closed()

async def main():
    """Main entry point"""
    server = OVLMBridgeServer(port=8765)
    await server.start_server()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
