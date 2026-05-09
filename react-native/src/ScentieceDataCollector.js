// ScentieceDataCollector.js
// React Native app for collecting sensor data and visual context for OVLM processing

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { check, PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { BRIDGE_SERVER_URL } from '@env';

// ── Config ────────────────────────────────────────────────────────────────────
// Falls back to localhost when .env is not set (simulator use-case).
const WS_URL = BRIDGE_SERVER_URL || 'ws://localhost:8765';

// ── Mock Scentience SDK ───────────────────────────────────────────────────────
// Replace with the real SDK when available: import Scentience from 'scentience';
const MockScentienceSDK = {
  ScentienceDevice: class {
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.connected = false;
    }

    async connectSocket() {
      await new Promise(resolve => setTimeout(resolve, 800));
      this.connected = true;
      return { success: true };
    }

    async sample({ async: _async = true } = {}) {
      if (!this.connected) throw new Error('Device not connected');
      return {
        UID: 'SCN001',
        TIMESTAMP: new Date().toISOString(),
        ENV_temperatureC: 22 + (Math.random() - 0.5) * 4,
        ENV_humidity: 45 + (Math.random() - 0.5) * 20,
        ENV_pressureHpa: 1010 + (Math.random() - 0.5) * 10,
        BATT_charge: 85,
        CO2: 400 + Math.random() * 200,
        NH3: 150 + Math.random() * 400,
        NO: Math.random() * 25,
        NO2: Math.random() * 25,
        CO: 500 + Math.random() * 1000,
        C2H5OH: Math.random() * 600,
        H2: 100 + Math.random() * 150,
        CH4: 300 + Math.random() * 300,
        VOC: 1500 + Math.random() * 2000,
      };
    }
  },
};

// ── WebSocket Helper ──────────────────────────────────────────────────────────
/**
 * Sends sensor data to the bridge server over WebSocket.
 * Falls back gracefully if the server is unreachable.
 */
async function sendSensorDataToServer(ws, sensorData, visualContext) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const payload = JSON.stringify({
    type: 'external_sensor_data',
    olfactory: sensorData,
    visual: visualContext || null,
    timestamp: new Date().toISOString(),
  });
  ws.send(payload);
}

// ── Main Component ─────────────────────────────────────────────────────────────
const ScentieceDataCollector = () => {
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [isStreaming, setIsStreaming] = useState(false);
  const [sensorData, setSensorData] = useState(null);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [lastCapture, setLastCapture] = useState(null);
  const [ovlmProcessing, setOvlmProcessing] = useState(false);

  const cameraRef = useRef(null);
  const streamingInterval = useRef(null);
  const scentienceDevice = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const devices = useCameraDevices();
  const device = devices.back;

  // ── Permissions ──────────────────────────────────────────────────────────
  const checkPermissions = useCallback(async () => {
    const perm = Platform.select({
      ios: PERMISSIONS.IOS.CAMERA,
      android: PERMISSIONS.ANDROID.CAMERA,
    });
    const status = await check(perm);
    if (status === RESULTS.GRANTED) {
      setCameraPermission(true);
    } else {
      const result = await request(perm);
      setCameraPermission(result === RESULTS.GRANTED);
    }
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      clearTimeout(reconnectTimer.current);
    };

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] Received:', msg.type);
      } catch {
        // ignore non-JSON
      }
    };

    ws.onerror = err => {
      console.warn('[WS] Error:', err.message);
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
      // Auto-reconnect after 4 seconds
      reconnectTimer.current = setTimeout(connectWebSocket, 4000);
    };
  }, []);

  // ── Scentience Device ─────────────────────────────────────────────────────
  const initializeScentieceDevice = useCallback(async () => {
    try {
      scentienceDevice.current = new MockScentienceSDK.ScentienceDevice('YOUR_API_KEY');
      await scentienceDevice.current.connectSocket();
      setDeviceConnected(true);
    } catch (error) {
      Alert.alert('Connection Error', `Failed to connect to Scentience device: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
    initializeScentieceDevice();
    connectWebSocket();

    return () => {
      clearInterval(streamingInterval.current);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [checkPermissions, initializeScentieceDevice, connectWebSocket]);

  // ── Camera ────────────────────────────────────────────────────────────────
  const captureVisualContext = async () => {
    if (!cameraRef.current || !cameraPermission) return null;
    try {
      const photo = await cameraRef.current.takePhoto({ quality: 0.8, format: 'jpeg' });
      setLastCapture(photo.path);
      return { image_path: photo.path, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  };

  // ── Sensor Sampling ───────────────────────────────────────────────────────
  const collectSensorData = async () => {
    if (!deviceConnected || !scentienceDevice.current) return null;
    try {
      const data = await scentienceDevice.current.sample({ async: true });
      setSensorData(data);
      return data;
    } catch (error) {
      Alert.alert('Sensor Error', `Failed to collect data: ${error.message}`);
      return null;
    }
  };

  // ── OVLM via WebSocket ────────────────────────────────────────────────────
  const processWithOVLM = async (sensors, visual) => {
    setOvlmProcessing(true);
    try {
      await sendSensorDataToServer(wsRef.current, sensors, visual);
    } catch (error) {
      console.error('OVLM send error:', error);
      Alert.alert('Processing Error', 'Failed to send data to OVLM bridge server.');
    } finally {
      setOvlmProcessing(false);
    }
  };

  const performFullAnalysis = async () => {
    const [sensors, visual] = await Promise.all([collectSensorData(), captureVisualContext()]);
    if (sensors) await processWithOVLM(sensors, visual);
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      clearInterval(streamingInterval.current);
      streamingInterval.current = null;
      setIsStreaming(false);
    } else {
      setIsStreaming(true);
      streamingInterval.current = setInterval(async () => {
        const sensors = await collectSensorData();
        if (sensors) await processWithOVLM(sensors, null);
      }, 5000);
    }
  };

  // ── Render Helpers ────────────────────────────────────────────────────────
  const wsStatusColor = { connected: '#2ECC71', connecting: '#F39C12', disconnected: '#E74C3C' };

  const renderSensorData = () => {
    if (!sensorData) return null;
    const keyMetrics = [
      { label: 'Temperature', value: `${sensorData.ENV_temperatureC?.toFixed(1)}°C`, color: '#FF6B6B' },
      { label: 'Humidity',    value: `${sensorData.ENV_humidity?.toFixed(1)}%`,       color: '#4ECDC4' },
      { label: 'CO₂',         value: `${sensorData.CO2?.toFixed(0)} ppm`,             color: '#45B7D1' },
      { label: 'NH₃',         value: `${sensorData.NH3?.toFixed(0)} ppb`,             color: '#F39C12' },
      { label: 'VOC',          value: `${sensorData.VOC?.toFixed(0)} ppb`,             color: '#9B59B6' },
      { label: 'Battery',      value: `${sensorData.BATT_charge}%`,                   color: '#2ECC71' },
    ];

    return (
      <View style={styles.sensorContainer}>
        <Text style={styles.sectionTitle}>Live Sensor Data</Text>
        <View style={styles.metricsGrid}>
          {keyMetrics.map((m, i) => (
            <View key={i} style={styles.metricCard}>
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
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
        {/* Device Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: deviceConnected ? '#2ECC71' : '#E74C3C' }]} />
          <Text style={styles.statusText}>
            {deviceConnected ? 'Scentience: Connected' : 'Scentience: Disconnected'}
          </Text>
        </View>

        {/* WebSocket Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, { backgroundColor: wsStatusColor[wsStatus] }]} />
          <Text style={styles.statusText}>
            Bridge Server: {wsStatus.charAt(0).toUpperCase() + wsStatus.slice(1)}
          </Text>
          {wsStatus === 'disconnected' && (
            <TouchableOpacity onPress={connectWebSocket} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
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

        {renderSensorData()}

        {/* Controls */}
        <View style={styles.controlPanel}>
          <Text style={styles.sectionTitle}>Controls</Text>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton,
              (!deviceConnected || ovlmProcessing) && styles.disabledButton]}
            onPress={performFullAnalysis}
            disabled={!deviceConnected || ovlmProcessing}>
            <Text style={styles.buttonText}>
              {ovlmProcessing ? 'Processing...' : '🧬 Analyze with OVLM'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isStreaming ? styles.stopButton : styles.streamButton,
              !deviceConnected && styles.disabledButton]}
            onPress={toggleStreaming}
            disabled={!deviceConnected}>
            <Text style={styles.buttonText}>
              {isStreaming ? '⏹️ Stop Streaming' : '▶️ Start Streaming'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton,
              !deviceConnected && styles.disabledButton]}
            onPress={collectSensorData}
            disabled={!deviceConnected}>
            <Text style={styles.buttonText}>📊 Sample Once</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Bridge server: {WS_URL}{'\n'}
            This app streams olfactory sensor data to the OVLM bridge which forwards
            analysis results to the iOS Nose Filter app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#2C3E50' },
  header:             { padding: 20, paddingTop: 50, backgroundColor: '#34495E', alignItems: 'center' },
  headerTitle:        { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle:     { fontSize: 16, color: '#BDC3C7', marginTop: 4 },
  content:            { flex: 1, padding: 20 },
  statusContainer:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 15,
                        backgroundColor: '#34495E', borderRadius: 10 },
  statusIndicator:    { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  statusText:         { color: '#FFFFFF', fontSize: 15, fontWeight: '500', flex: 1 },
  retryButton:        { backgroundColor: '#3498DB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  retryText:          { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  sectionTitle:       { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 15 },
  cameraContainer:    { marginBottom: 20 },
  cameraWrapper:      { height: 200, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  camera:             { flex: 1 },
  lastCaptureOverlay: { position: 'absolute', top: 10, right: 10, alignItems: 'center' },
  captureText:        { color: '#FFFFFF', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: 4, borderRadius: 4 },
  thumbnail:          { width: 60, height: 60, borderRadius: 8, marginTop: 5,
                        borderWidth: 2, borderColor: '#FFFFFF' },
  sensorContainer:    { marginBottom: 20 },
  metricsGrid:        { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard:         { width: '48%', backgroundColor: '#34495E', padding: 15, borderRadius: 10,
                        marginBottom: 10, alignItems: 'center' },
  metricValue:        { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  metricLabel:        { color: '#BDC3C7', fontSize: 14 },
  controlPanel:       { marginBottom: 20 },
  button:             { padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  primaryButton:      { backgroundColor: '#3498DB' },
  streamButton:       { backgroundColor: '#2ECC71' },
  stopButton:         { backgroundColor: '#E74C3C' },
  secondaryButton:    { backgroundColor: '#9B59B6' },
  disabledButton:     { opacity: 0.5 },
  buttonText:         { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  infoContainer:      { padding: 15, backgroundColor: '#34495E', borderRadius: 10, marginBottom: 20 },
  infoText:           { color: '#BDC3C7', fontSize: 13, lineHeight: 20 },
});

export default ScentieceDataCollector;
