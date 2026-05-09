// ScentieceDataCollector.js
// React Native app for collecting sensor data and visual context for OVLM processing

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { check, PERMISSIONS, request } from 'react-native-permissions';

// Mock Scentience SDK (replace with actual when available)
const MockScentienceSDK = {
  ScentienceDevice: class {
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.connected = false;
    }

    async connectSocket() {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.connected = true;
      return { success: true };
    }

    async sample({ async: isAsync = true }) {
      if (!this.connected) throw new Error('Device not connected');
      
      // Simulate sensor data
      const mockData = {
        UID: "SCN001",
        TIMESTAMP: new Date().toISOString(),
        ENV_temperatureC: 22 + (Math.random() - 0.5) * 4,
        ENV_humidity: 45 + (Math.random() - 0.5) * 20,
        ENV_pressureHpa: 1010 + (Math.random() - 0.5) * 10,
        BATT_charge: 85,
        CO2: 400 + Math.random() * 200,
        NH3: 150 + Math.random() * 400, // Stress indicator
        NO: Math.random() * 25,
        NO2: Math.random() * 25,
        CO: 500 + Math.random() * 1000,
        C2H5OH: Math.random() * 600,
        H2: 100 + Math.random() * 150,
        CH4: 300 + Math.random() * 300,
        VOC: 1500 + Math.random() * 2000, // Air quality
      };

      return mockData;
    }

    async stream({ async: isAsync = true }) {
      // Start streaming simulation
      return this.sample({ async: isAsync });
    }
  }
};

const ScentieceDataCollector = () => {
  // State management
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sensorData, setSensorData] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [lastCapture, setLastCapture] = useState(null);
  const [ovlmProcessing, setOvlmProcessing] = useState(false);

  // Refs
  const cameraRef = useRef(null);
  const streamingInterval = useRef(null);
  const scentienceDevice = useRef(null);

  // Camera setup
  const devices = useCameraDevices();
  const device = devices.back;

  useEffect(() => {
    checkPermissions();
    initializeScentieceDevice();
    
    return () => {
      if (streamingInterval.current) {
        clearInterval(streamingInterval.current);
      }
    };
  }, []);

  const checkPermissions = async () => {
    const permission = Platform.select({
      ios: PERMISSIONS.IOS.CAMERA,
      android: PERMISSIONS.ANDROID.CAMERA,
    });

    const result = await check(permission);
    if (result === 'granted') {
      setCameraPermission(true);
    } else {
      const requestResult = await request(permission);
      setCameraPermission(requestResult === 'granted');
    }
  };

  const initializeScentieceDevice = async () => {
    try {
      // Initialize with your actual API key
      scentienceDevice.current = new MockScentienceSDK.ScentienceDevice("YOUR_API_KEY");
      await scentienceDevice.current.connectSocket();
      setDeviceConnected(true);
      
      Alert.alert("Success", "Connected to Scentience device!");
    } catch (error) {
      Alert.alert("Connection Error", `Failed to connect: ${error.message}`);
    }
  };

  const captureVisualContext = async () => {
    if (!cameraRef.current || !cameraPermission) return null;

    try {
      const photo = await cameraRef.current.takePhoto({
        quality: 0.8,
        format: 'jpeg',
      });

      setLastCapture(photo.path);
      
      // In a real implementation, you'd process this image for OVLM
      return {
        image_path: photo.path,
        timestamp: new Date().toISOString(),
        context: "Environmental context captured",
      };
    } catch (error) {
      console.error("Camera capture error:", error);
      return null;
    }
  };

  const collectSensorData = async () => {
    if (!deviceConnected || !scentienceDevice.current) return null;

    try {
      const data = await scentienceDevice.current.sample({ async: true });
      setSensorData(data);
      return data;
    } catch (error) {
      Alert.alert("Sensor Error", `Failed to collect data: ${error.message}`);
      return null;
    }
  };

  const processWithOVLM = async (sensorData, visualContext) => {
    setOvlmProcessing(true);
    
    try {
      // Simulate OVLM processing
      const ovlmInput = {
        olfactory: sensorData,
        visual: visualContext,
        text: "Analyze air quality and detect stress hormones for nasal filtering device",
        timestamp: new Date().toISOString(),
      };

      // In real implementation, send to your OVLM bridge server
      const response = await fetch('http://localhost:8765/ovlm-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ovlmInput),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("OVLM Result:", result);
        
        // Send to iOS nose filter app via WebSocket (handled by bridge server)
        Alert.alert(
          "OVLM Analysis Complete", 
          "Results sent to your nose filter device!"
        );
      }
    } catch (error) {
      console.error("OVLM processing error:", error);
      Alert.alert("Processing Error", "Failed to process with OVLM");
    } finally {
      setOvlmProcessing(false);
    }
  };

  const performFullAnalysis = async () => {
    Alert.alert(
      "Starting Analysis",
      "Collecting sensor data and visual context...",
      [{ text: "OK" }]
    );

    // Collect data
    const [sensors, visual] = await Promise.all([
      collectSensorData(),
      captureVisualContext(),
    ]);

    if (sensors) {
      await processWithOVLM(sensors, visual);
    }
  };

  const toggleStreaming = async () => {
    if (isStreaming) {
      // Stop streaming
      if (streamingInterval.current) {
        clearInterval(streamingInterval.current);
        streamingInterval.current = null;
      }
      setIsStreaming(false);
    } else {
      // Start streaming
      setIsStreaming(true);
      streamingInterval.current = setInterval(async () => {
        const sensors = await collectSensorData();
        if (sensors) {
          // Send to OVLM bridge for real-time processing
          await processWithOVLM(sensors, null);
        }
      }, 5000); // Every 5 seconds
    }
  };

  const renderSensorData = () => {
    if (!sensorData) return null;

    const keyMetrics = [
      { label: 'Temperature', value: `${sensorData.ENV_temperatureC?.toFixed(1)}°C`, color: '#FF6B6B' },
      { label: 'Humidity', value: `${sensorData.ENV_humidity?.toFixed(1)}%`, color: '#4ECDC4' },
      { label: 'CO₂', value: `${sensorData.CO2?.toFixed(0)} ppm`, color: '#45B7D1' },
      { label: 'NH₃', value: `${sensorData.NH3?.toFixed(0)} ppb`, color: '#F39C12' },
      { label: 'VOC', value: `${sensorData.VOC?.toFixed(0)} ppb`, color: '#9B59B6' },
      { label: 'Battery', value: `${sensorData.BATT_charge}%`, color: '#2ECC71' },
    ];

    return (
      <View style={styles.sensorContainer}>
        <Text style={styles.sectionTitle}>Live Sensor Data</Text>
        <View style={styles.metricsGrid}>
          {keyMetrics.map((metric, index) => (
            <View key={index} style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: metric.color }]}>
                {metric.value}
              </Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2C3E50" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scentience OVLM</Text>
        <Text style={styles.headerSubtitle}>Data Collection Hub</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: deviceConnected ? '#2ECC71' : '#E74C3C' }]} />
          <Text style={styles.statusText}>
            {deviceConnected ? 'Device Connected' : 'Device Disconnected'}
          </Text>
        </View>

        {/* Camera Preview */}
        {cameraPermission && device && (
          <View style={styles.cameraContainer}>
            <Text style={styles.sectionTitle}>Visual Context</Text>
            <View style={styles.cameraWrapper}>
              <Camera
                ref={cameraRef}
                style={styles.camera}
                device={device}
                isActive={true}
                photo={true}
              />
              {lastCapture && (
                <View style={styles.lastCaptureOverlay}>
                  <Text style={styles.captureText}>Last Capture</Text>
                  <Image source={{ uri: `file://${lastCapture}` }} style={styles.thumbnail} />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Sensor Data Display */}
        {renderSensorData()}

        {/* Control Panel */}
        <View style={styles.controlPanel}>
          <Text style={styles.sectionTitle}>Controls</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={performFullAnalysis}
            disabled={!deviceConnected || ovlmProcessing}
          >
            <Text style={styles.buttonText}>
              {ovlmProcessing ? 'Processing...' : '🧬 Analyze with OVLM'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isStreaming ? styles.stopButton : styles.streamButton]}
            onPress={toggleStreaming}
            disabled={!deviceConnected}
          >
            <Text style={styles.buttonText}>
              {isStreaming ? '⏹️ Stop Streaming' : '▶️ Start Streaming'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={collectSensorData}
            disabled={!deviceConnected}
          >
            <Text style={styles.buttonText}>📊 Sample Once</Text>
          </TouchableOpacity>
        </View>

        {/* Status Information */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            This app collects olfactory sensor data and visual context, processes it through the OVLM, 
            and sends insights to your nose filter device app via WebSocket.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2C3E50',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#34495E',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#BDC3C7',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#34495E',
    borderRadius: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  cameraContainer: {
    marginBottom: 20,
  },
  cameraWrapper: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  lastCaptureOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'center',
  },
  captureText: {
    color: '#FFFFFF',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 4,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginTop: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sensorContainer: {
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#34495E',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  metricLabel: {
    color: '#BDC3C7',
    fontSize: 14,
  },
  controlPanel: {
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#3498DB',
  },
  streamButton: {
    backgroundColor: '#2ECC71',
  },
  stopButton: {
    backgroundColor: '#E74C3C',
  },
  secondaryButton: {
    backgroundColor: '#9B59B6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 15,
    backgroundColor: '#34495E',
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    color: '#BDC3C7',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ScentieceDataCollector;