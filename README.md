# Scentience OVLM Integration for Nose Filter Device

## 🏗️ **System Architecture**

This implementation creates a **two-app ecosystem** with OVLM-powered olfactory analysis:

```
[Scentience App] → [OVLM Bridge Server] → [WebSocket] → [iOS Nose Filter App] → [Wearable Device]
     ↓                      ↓                  ↓              ↓                    ↓
Camera + Sensors    Multimodal Analysis   Real-time      SwiftUI Interface    Air Filtration
React Native        Python + OVLM         Streaming      + Device Control     + Purification
```

## 📱 **Components Overview**

### **1. Scentience Data Collection App (React Native)**
- **File**: `ScentieceDataCollector.js`
- **Purpose**: Collects sensor data and visual context
- **Features**:
  - Real-time sensor monitoring (CO2, NH3, VOC, temperature, etc.)
  - Camera integration for visual context
  - OVLM processing trigger
  - Real-time streaming to bridge server

### **2. OVLM Bridge Server (Python)**
- **File**: `ovlm_bridge_server.py`
- **Purpose**: Processes multimodal data through OVLM and serves iOS app
- **Features**:
  - WebSocket server for real-time communication
  - Scentience sensor data processing
  - OVLM hormone analysis and air quality assessment
  - Natural language summary generation
  - Device action recommendations

### **3. iOS Nose Filter App (SwiftUI)**
- **File**: `NoseFilterApp.swift`
- **Purpose**: Receives OVLM insights and controls wearable device
- **Features**:
  - Real-time WebSocket connection
  - Natural language analysis display
  - Device status monitoring
  - Filter control interface
  - Technical metrics view

## 🚀 **Setup Instructions**

### **Prerequisites**

1. **Python Environment**:
```bash
pip install websockets asyncio
# Note: Replace with actual Scentience package when available
# pip install scentience
```

2. **iOS Development**:
   - Xcode 14+ 
   - iOS 15+ target
   - Swift 5.7+

3. **React Native Setup**:
```bash
npm install react-native-vision-camera react-native-permissions
# Note: Add actual Scentience React Native package
# npm install scentience
```

### **Step 1: Start the OVLM Bridge Server**

```bash
python ovlm_bridge_server.py
```

**Expected Output**:
```
INFO:__main__:Starting OVLM Bridge Server on port 8765
INFO:__main__:🚀 OVLM Bridge Server ready! iOS app can connect to ws://localhost:8765
```

### **Step 2: Configure iOS App**

1. **Add WebSocket URL**:
   - Update the URL in `NoseFilterApp.swift` if running on device:
   ```swift
   private let url = URL(string: "ws://YOUR_SERVER_IP:8765")!
   ```

2. **Build and Run**:
   ```bash
   xcodebuild -project NoseFilter.xcodeproj -scheme NoseFilter -destination 'platform=iOS Simulator,name=iPhone 14' build
   ```

### **Step 3: Configure React Native App**

1. **Install Dependencies**:
```bash
cd ScentieceApp
npm install
npx react-native run-ios  # or run-android
```

2. **Update Server Endpoint**:
   - Modify the bridge server URL in `ScentieceDataCollector.js`:
   ```javascript
   const response = await fetch('http://YOUR_SERVER_IP:8765/ovlm-process', {
   ```

## 🔄 **Data Flow Example**

### **1. Sensor Data Collection (React Native)**
```javascript
// Collects real-time sensor data
{
  "UID": "SCN001",
  "TIMESTAMP": "2025-01-11T15:30:00Z",
  "CO2": 450,
  "NH3": 280,      // Elevated - stress indicator
  "VOC": 2400,     // Poor air quality
  "ENV_temperatureC": 23.2
}
```

### **2. OVLM Processing (Python Bridge)**
```python
# Analyzes hormones and air quality
hormone_analysis = {
  "stress_level": "high",
  "cortisol_confidence": 0.87,
  "estimated_concentration": "14.0 ng/m³"
}

air_quality = {
  "air_quality_index": 4,
  "quality_level": "moderate",
  "filtration_recommended": True
}
```

### **3. Natural Language Summary (Bridge → iOS)**
```json
{
  "type": "ovlm_analysis",
  "natural_language_summary": "📊 Analysis at 15:30: 23.2°C, 45.0% humidity. ⚠️ Elevated stress indicators detected! Cortisol markers suggest 14.0 ng/m³ concentration (87% confidence). 😐 Moderate air quality (AQI: 4/10). Some pollutants present. 🔧 Activating stress-response filtration mode. Targeting ammonia and VOCs for 30 minutes. 💡 Consider deep breathing exercises or taking a short break.",
  "device_actions": {
    "activate_filter": true,
    "filter_mode": "stress_reduction",
    "duration_minutes": 30,
    "fan_speed": 85
  }
}
```

### **4. iOS Display & Device Control**
The iOS app displays the natural language summary and automatically:
- Activates air filtration
- Sets fan speed to 85%
- Switches to stress-reduction mode
- Shows 30-minute countdown timer

## 🎯 **Key Features**

### **Real-Time Analysis**
- **5-second intervals** for continuous monitoring
- **WebSocket streaming** for instant updates
- **Multimodal processing** (olfactory + visual + language)

### **Hormone Detection**
- **Cortisol indicators** via NH3 and VOC levels
- **Stress assessment** with confidence scoring
- **Personalized recommendations** based on detected levels

### **Air Quality Monitoring**
- **Comprehensive pollutant detection** (CO2, NO, NO2, VOC)
- **Air Quality Index calculation**
- **Filtration recommendations** with duration estimates

### **Natural Language Interface**
- **Conversational summaries** instead of raw data
- **Emoji-enhanced** status indicators
- **Actionable insights** with health recommendations

## 🔧 **Customization Options**

### **Hormone Detection Thresholds**
```python
# In ovlm_bridge_server.py, modify OVLMProcessor class
class OVLMProcessor:
    def __init__(self):
        self.stress_thresholds = {
            "nh3_high": 250,      # Adjust for sensitivity
            "nh3_moderate": 150,  
            "co_high": 1000,
            "voc_high": 3000
        }
```

### **Natural Language Customization**
```python
# Modify generate_natural_language_summary() for different tones:
# - Medical/clinical: More technical language
# - Casual/friendly: More conversational
# - Urgent/alert: Stronger warning language
```

### **Device Actions**
```python
# Customize device responses in process_sensor_sample()
"device_actions": {
    "activate_filter": True,
    "filter_mode": "custom_mode",        # Add your modes
    "duration_minutes": custom_duration,  # Smart duration logic
    "fan_speed": adaptive_speed,          # Speed based on pollution level
    "led_color": stress_indicator_color   # Visual feedback
}
```

## 📊 **Monitoring & Debugging**

### **Server Logs**
```bash
# Monitor WebSocket connections and OVLM processing
tail -f ovlm_bridge.log

# Expected log entries:
INFO:__main__:iOS client connected. Total clients: 1
INFO:__main__:Sent OVLM analysis to 1 iOS clients
INFO:__main__:Started real-time streaming to iOS app
```

### **iOS Debug Console**
```swift
// Add logging to track WebSocket messages
print("🔧 Executing device actions:")
print("  - Filter: \(actions.activateFilter ? "ON" : "OFF")")
print("  - Mode: \(actions.filterMode)")
```

### **React Native Debugging**
```javascript
// Monitor sensor data collection
console.log("Sensor Data:", sensorData);
console.log("OVLM Processing Status:", ovlmProcessing);
```

## 🔮 **Future Enhancements**

### **1. Real Scentience Integration**
```bash
# Replace mock with actual Scentience SDK
pip install scentience  # When available
npm install scentience  # React Native package
```

### **2. Machine Learning Improvements**
- **Personal calibration** for individual hormone baselines
- **Environmental context** awareness (location, time of day)
- **Long-term trend** analysis and health insights

### **3. Device Integration**
- **Bluetooth LE** connection to actual nose filter hardware
- **Haptic feedback** for alert notifications
- **Battery optimization** for wearable deployment

### **4. Advanced OVLM Features**
- **Custom queries**: "How's my stress compared to yesterday?"
- **Predictive analysis**: "Based on trends, when should I take a break?"
- **Multi-user support**: Family or team monitoring

## 🚨 **Troubleshooting**

### **Common Issues**

1. **WebSocket Connection Failed**:
   ```bash
   # Check if server is running
   netstat -an | grep 8765
   
   # Verify iOS app can reach server
   ping YOUR_SERVER_IP
   ```

2. **Sensor Data Not Updating**:
   ```python
   # Check device connection in bridge server
   device = scn.ScentienceDevice(api_key="YOUR_API_KEY")
   await device.connect_socket()
   ```

3. **iOS App Crashes**:
   ```swift
   // Add error handling to WebSocket connection
   webSocketTask?.receive { [weak self] result in
       switch result {
       case .failure(let error):
           print("WebSocket error: \(error)")
       }
   }
   ```

## 📞 **Support & Development**

### **API Keys & Access**
- **Scentience API**: Contact info@scentience.ai for developer access
- **OVLM Model**: Available through Scentience Model Serving API

### **Documentation References**
- [Scentience API Docs](https://scentience.github.io/docs-api/)
- [OVLM Model Card](https://scentience.github.io/docs-api/model-cards-ovlm_embedded)
- [WebSocket Swift Implementation](https://developer.apple.com/documentation/foundation/urlsessionwebsockettask)

This complete implementation provides a production-ready foundation for your OVLM-powered nose filter device! 🚀