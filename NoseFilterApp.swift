import SwiftUI
import Foundation
import Combine

// MARK: - WebSocket Manager
class OVLMWebSocketManager: ObservableObject {
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var lastMessage: String = "Ready to connect to OVLM..."
    @Published var currentAnalysis: OVLMAnalysis?
    @Published var isStreaming: Bool = false
    
    private var webSocketTask: URLSessionWebSocketTask?
    private let url = URL(string: "ws://localhost:8765")!
    
    enum ConnectionStatus {
        case connected, disconnected, connecting
        
        var description: String {
            switch self {
            case .connected: return "Connected"
            case .disconnected: return "Disconnected"
            case .connecting: return "Connecting..."
            }
        }
        
        var color: Color {
            switch self {
            case .connected: return .green
            case .disconnected: return .red
            case .connecting: return .orange
            }
        }
    }
    
    func connect() {
        connectionStatus = .connecting
        webSocketTask = URLSession.shared.webSocketTask(with: url)
        webSocketTask?.resume()
        connectionStatus = .connected
        startListening()
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        connectionStatus = .disconnected
        isStreaming = false
    }
    
    private func startListening() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                self?.handleMessage(message)
                self?.startListening() // Continue listening
            case .failure(let error):
                DispatchQueue.main.async {
                    self?.connectionStatus = .disconnected
                    self?.lastMessage = "Connection error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            DispatchQueue.main.async {
                self.processMessage(text)
            }
        case .data(_):
            print("Received binary data (not supported)")
        @unknown default:
            print("Unknown message type")
        }
    }
    
    private func processMessage(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let messageType = json["type"] as? String else {
            return
        }
        
        switch messageType {
        case "connection_established":
            if let message = json["message"] as? String {
                lastMessage = message
            }
            
        case "ovlm_analysis":
            if let analysis = parseOVLMAnalysis(from: json) {
                currentAnalysis = analysis
                lastMessage = analysis.naturalLanguageSummary
                
                // Trigger device actions
                executeDeviceActions(analysis.deviceActions)
            }
            
        case "streaming_started":
            isStreaming = true
            if let message = json["message"] as? String {
                lastMessage = message
            }
            
        case "streaming_stopped":
            isStreaming = false
            if let message = json["message"] as? String {
                lastMessage = message
            }
            
        case "error":
            if let message = json["message"] as? String {
                lastMessage = "❌ " + message
            }
            
        default:
            if let message = json["message"] as? String {
                lastMessage = message
            }
        }
    }
    
    private func parseOVLMAnalysis(from json: [String: Any]) -> OVLMAnalysis? {
        guard let analysisId = json["analysis_id"] as? String,
              let timestamp = json["timestamp"] as? String,
              let summary = json["natural_language_summary"] as? String,
              let deviceActionsDict = json["device_actions"] as? [String: Any],
              let rawMetricsDict = json["raw_metrics"] as? [String: Any] else {
            return nil
        }
        
        let deviceActions = DeviceActions(
            activateFilter: deviceActionsDict["activate_filter"] as? Bool ?? false,
            filterMode: deviceActionsDict["filter_mode"] as? String ?? "standard",
            durationMinutes: deviceActionsDict["duration_minutes"] as? Int ?? 15,
            alertLevel: deviceActionsDict["alert_level"] as? Int ?? 0,
            fanSpeed: deviceActionsDict["fan_speed"] as? Int ?? 65
        )
        
        let rawMetrics = RawMetrics(
            stressConfidence: rawMetricsDict["stress_confidence"] as? Double ?? 0.0,
            airQualityScore: rawMetricsDict["air_quality_score"] as? Int ?? 5,
            cortisolEstimate: rawMetricsDict["cortisol_estimate"] as? String ?? "0.0 ng/m³"
        )
        
        return OVLMAnalysis(
            analysisId: analysisId,
            timestamp: timestamp,
            naturalLanguageSummary: summary,
            deviceActions: deviceActions,
            rawMetrics: rawMetrics
        )
    }
    
    private func executeDeviceActions(_ actions: DeviceActions) {
        // Here you would integrate with your actual nose filter device
        print("🔧 Executing device actions:")
        print("  - Filter: \(actions.activateFilter ? "ON" : "OFF")")
        print("  - Mode: \(actions.filterMode)")
        print("  - Duration: \(actions.durationMinutes) minutes")
        print("  - Fan Speed: \(actions.fanSpeed)%")
        print("  - Alert Level: \(actions.alertLevel)/10")
        
        // Example: Send commands to your wearable device
        // noseFilterDevice.setFilterMode(actions.filterMode)
        // noseFilterDevice.setFanSpeed(actions.fanSpeed)
    }
    
    func sendMessage(_ message: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let jsonString = String(data: data, encoding: .utf8) else {
            return
        }
        
        webSocketTask?.send(.string(jsonString)) { error in
            if let error = error {
                DispatchQueue.main.async {
                    self.lastMessage = "Send error: \(error.localizedDescription)"
                }
            }
        }
    }
    
    func startStreaming() {
        sendMessage(["type": "start_streaming"])
    }
    
    func stopStreaming() {
        sendMessage(["type": "stop_streaming"])
    }
    
    func sampleOnce() {
        sendMessage(["type": "sample_once"])
    }
    
    func sendCustomQuery(_ query: String) {
        sendMessage(["type": "custom_query", "query": query])
    }
}

// MARK: - Data Models
struct OVLMAnalysis {
    let analysisId: String
    let timestamp: String
    let naturalLanguageSummary: String
    let deviceActions: DeviceActions
    let rawMetrics: RawMetrics
}

struct DeviceActions {
    let activateFilter: Bool
    let filterMode: String
    let durationMinutes: Int
    let alertLevel: Int
    let fanSpeed: Int
}

struct RawMetrics {
    let stressConfidence: Double
    let airQualityScore: Int
    let cortisolEstimate: String
}

// MARK: - Main App View
struct ContentView: View {
    @StateObject private var webSocketManager = OVLMWebSocketManager()
    @State private var customQuery = ""
    @State private var showingMetrics = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    headerSection
                    
                    // Connection Status
                    connectionSection
                    
                    // Control Panel
                    controlSection
                    
                    // Analysis Display
                    analysisSection
                    
                    // Device Status (if analysis available)
                    if let analysis = webSocketManager.currentAnalysis {
                        deviceStatusSection(analysis)
                    }
                    
                    // Raw Metrics (collapsible)
                    if let analysis = webSocketManager.currentAnalysis {
                        rawMetricsSection(analysis)
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Nose Filter AI")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    private var headerSection: some View {
        VStack {
            Image(systemName: "nose.fill")
                .font(.system(size: 60))
                .foregroundColor(.blue)
            Text("OVLM-Powered Air Purification")
                .font(.title2)
                .fontWeight(.medium)
                .multilineTextAlignment(.center)
        }
        .padding(.top)
    }
    
    private var connectionSection: some View {
        HStack {
            Circle()
                .fill(webSocketManager.connectionStatus.color)
                .frame(width: 12, height: 12)
            Text(webSocketManager.connectionStatus.description)
                .font(.subheadline)
                .fontWeight(.medium)
            
            Spacer()
            
            if webSocketManager.connectionStatus == .disconnected {
                Button("Connect") {
                    webSocketManager.connect()
                }
                .buttonStyle(.borderedProminent)
            } else {
                Button("Disconnect") {
                    webSocketManager.disconnect()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    private var controlSection: some View {
        VStack(spacing: 12) {
            Text("Controls")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)
            
            HStack(spacing: 12) {
                Button(action: {
                    if webSocketManager.isStreaming {
                        webSocketManager.stopStreaming()
                    } else {
                        webSocketManager.startStreaming()
                    }
                }) {
                    HStack {
                        Image(systemName: webSocketManager.isStreaming ? "pause.fill" : "play.fill")
                        Text(webSocketManager.isStreaming ? "Stop" : "Start")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(webSocketManager.connectionStatus != .connected)
                
                Button("Sample Once") {
                    webSocketManager.sampleOnce()
                }
                .buttonStyle(.bordered)
                .disabled(webSocketManager.connectionStatus != .connected)
            }
            
            // Custom Query Section
            VStack {
                HStack {
                    TextField("Ask OVLM a question...", text: $customQuery)
                        .textFieldStyle(.roundedBorder)
                    
                    Button("Send") {
                        if !customQuery.isEmpty {
                            webSocketManager.sendCustomQuery(customQuery)
                            customQuery = ""
                        }
                    }
                    .disabled(customQuery.isEmpty || webSocketManager.connectionStatus != .connected)
                }
            }
        }
    }
    
    private var analysisSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("OVLM Analysis")
                .font(.headline)
            
            Text(webSocketManager.lastMessage)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .font(.body)
        }
    }
    
    private func deviceStatusSection(_ analysis: OVLMAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Device Status")
                .font(.headline)
            
            VStack(spacing: 8) {
                statusRow("Filter", analysis.deviceActions.activateFilter ? "Active" : "Inactive", 
                         analysis.deviceActions.activateFilter ? .green : .gray)
                statusRow("Mode", analysis.deviceActions.filterMode.capitalized, .blue)
                statusRow("Duration", "\(analysis.deviceActions.durationMinutes) min", .orange)
                statusRow("Fan Speed", "\(analysis.deviceActions.fanSpeed)%", .purple)
                statusRow("Alert Level", "\(analysis.deviceActions.alertLevel)/10", alertLevelColor(analysis.deviceActions.alertLevel))
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }
    
    private func statusRow(_ label: String, _ value: String, _ color: Color) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(color)
        }
    }
    
    private func alertLevelColor(_ level: Int) -> Color {
        switch level {
        case 0...3: return .green
        case 4...6: return .orange
        default: return .red
        }
    }
    
    private func rawMetricsSection(_ analysis: OVLMAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: {
                showingMetrics.toggle()
            }) {
                HStack {
                    Text("Technical Metrics")
                        .font(.headline)
                    Spacer()
                    Image(systemName: showingMetrics ? "chevron.up" : "chevron.down")
                }
            }
            .foregroundColor(.primary)
            
            if showingMetrics {
                VStack(spacing: 8) {
                    metricRow("Stress Confidence", String(format: "%.0f%%", analysis.rawMetrics.stressConfidence * 100))
                    metricRow("Air Quality Score", "\(analysis.rawMetrics.airQualityScore)/10")
                    metricRow("Cortisol Estimate", analysis.rawMetrics.cortisolEstimate)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .transition(.opacity)
            }
        }
        .animation(.easeInOut, value: showingMetrics)
    }
    
    private func metricRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

// MARK: - App Entry Point
@main
struct NoseFilterApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

// MARK: - Preview
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}