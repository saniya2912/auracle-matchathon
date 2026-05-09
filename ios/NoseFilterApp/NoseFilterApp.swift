import SwiftUI
import Foundation
import Combine

// MARK: - WebSocket Manager
class OVLMWebSocketManager: ObservableObject {
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var lastMessage: String = "Ready to connect to OVLM..."
    @Published var currentAnalysis: OVLMAnalysis?
    @Published var isStreaming: Bool = false
    @Published var reconnectCountdown: Int = 0

    private var webSocketTask: URLSessionWebSocketTask?
    private var reconnectTask: Task<Void, Never>?
    private var reconnectAttempts = 0

    enum ConnectionStatus: Equatable {
        case connected
        case disconnected
        case connecting
        case reconnecting(attempt: Int)

        var description: String {
            switch self {
            case .connected:       return "Connected"
            case .disconnected:    return "Disconnected"
            case .connecting:      return "Connecting..."
            case .reconnecting(let n): return "Reconnecting (\(n))..."
            }
        }

        var color: Color {
            switch self {
            case .connected:    return .green
            case .disconnected: return .red
            case .connecting:   return .orange
            case .reconnecting: return .orange
            }
        }

        var isActive: Bool {
            if case .connected = self { return true }
            return false
        }
    }

    // MARK: - Connect / Disconnect

    func connect() {
        guard connectionStatus == .disconnected else { return }
        reconnectAttempts = 0
        openConnection()
    }

    func disconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
        closeConnection()
        reconnectAttempts = 0
    }

    private func openConnection() {
        connectionStatus = .connecting
        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: AppConfig.serverURL)
        webSocketTask?.resume()
        listenForMessages()
        // URLSessionWebSocketTask doesn't expose a connect callback — treat resume as "connected"
        // and update status once the server sends its welcome message.
        connectionStatus = .connected
    }

    private func closeConnection(code: URLSessionWebSocketTask.CloseCode = .goingAway) {
        webSocketTask?.cancel(with: code, reason: nil)
        webSocketTask = nil
        DispatchQueue.main.async {
            self.connectionStatus = .disconnected
            self.isStreaming = false
        }
    }

    // MARK: - Auto-reconnect

    private func scheduleReconnect() {
        let maxAttempts = AppConfig.maxReconnectAttempts
        guard maxAttempts == 0 || reconnectAttempts < maxAttempts else {
            DispatchQueue.main.async {
                self.lastMessage = "❌ Could not reconnect after \(self.reconnectAttempts) attempts."
                self.connectionStatus = .disconnected
            }
            return
        }

        reconnectAttempts += 1
        DispatchQueue.main.async {
            self.connectionStatus = .reconnecting(attempt: self.reconnectAttempts)
        }

        reconnectTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(AppConfig.reconnectDelay * 1_000_000_000))
            guard !Task.isCancelled else { return }
            await MainActor.run { self.openConnection() }
        }
    }

    // MARK: - Listening

    private func listenForMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                self.handleRawMessage(message)
                self.listenForMessages()
            case .failure(let error):
                DispatchQueue.main.async {
                    self.lastMessage = "Connection error: \(error.localizedDescription)"
                    self.closeConnection(code: .abnormalClosure)
                    self.scheduleReconnect()
                }
            }
        }
    }

    private func handleRawMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            DispatchQueue.main.async { self.processMessage(text) }
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                DispatchQueue.main.async { self.processMessage(text) }
            }
        @unknown default:
            break
        }
    }

    // MARK: - Message Parsing

    private func processMessage(_ jsonString: String) {
        guard
            let data = jsonString.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let messageType = json["type"] as? String
        else { return }

        switch messageType {
        case "connection_established":
            if let msg = json["message"] as? String { lastMessage = msg }
            connectionStatus = .connected
            reconnectAttempts = 0

        case "ovlm_analysis":
            if let analysis = parseOVLMAnalysis(from: json) {
                currentAnalysis = analysis
                lastMessage = analysis.naturalLanguageSummary
                executeDeviceActions(analysis.deviceActions)
            }

        case "streaming_started":
            isStreaming = true
            if let msg = json["message"] as? String { lastMessage = msg }

        case "streaming_stopped":
            isStreaming = false
            if let msg = json["message"] as? String { lastMessage = msg }

        case "error":
            if let msg = json["message"] as? String { lastMessage = "❌ " + msg }

        default:
            if let msg = json["message"] as? String { lastMessage = msg }
        }
    }

    private func parseOVLMAnalysis(from json: [String: Any]) -> OVLMAnalysis? {
        guard
            let analysisId = json["analysis_id"] as? String,
            let timestamp  = json["timestamp"] as? String,
            let summary    = json["natural_language_summary"] as? String,
            let actDict    = json["device_actions"] as? [String: Any],
            let metDict    = json["raw_metrics"] as? [String: Any]
        else { return nil }

        let actions = DeviceActions(
            activateFilter:  actDict["activate_filter"]  as? Bool   ?? false,
            filterMode:      actDict["filter_mode"]       as? String ?? "standard",
            durationMinutes: actDict["duration_minutes"]  as? Int    ?? 15,
            alertLevel:      actDict["alert_level"]       as? Int    ?? 0,
            fanSpeed:        actDict["fan_speed"]         as? Int    ?? 65
        )
        let metrics = RawMetrics(
            stressConfidence: metDict["stress_confidence"] as? Double ?? 0.0,
            airQualityScore:  metDict["air_quality_score"] as? Int    ?? 5,
            cortisolEstimate: metDict["cortisol_estimate"] as? String ?? "0.0 ng/m³"
        )
        return OVLMAnalysis(
            analysisId: analysisId,
            timestamp: timestamp,
            naturalLanguageSummary: summary,
            deviceActions: actions,
            rawMetrics: metrics
        )
    }

    private func executeDeviceActions(_ actions: DeviceActions) {
        print("🔧 Device actions — Filter: \(actions.activateFilter ? "ON" : "OFF"), " +
              "Mode: \(actions.filterMode), Fan: \(actions.fanSpeed)%, " +
              "Duration: \(actions.durationMinutes)min, Alert: \(actions.alertLevel)/10")
        // Integrate actual BLE / hardware commands here
    }

    // MARK: - Sending

    func sendMessage(_ payload: [String: Any]) {
        guard
            connectionStatus.isActive,
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let text = String(data: data, encoding: .utf8)
        else { return }

        webSocketTask?.send(.string(text)) { [weak self] error in
            if let error {
                DispatchQueue.main.async {
                    self?.lastMessage = "Send error: \(error.localizedDescription)"
                }
            }
        }
    }

    func startStreaming()  { sendMessage(["type": "start_streaming"]) }
    func stopStreaming()   { sendMessage(["type": "stop_streaming"]) }
    func sampleOnce()     { sendMessage(["type": "sample_once"]) }
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
    @StateObject private var ws = OVLMWebSocketManager()
    @State private var customQuery = ""
    @State private var showingMetrics = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    headerSection
                    connectionSection
                    controlSection
                    analysisSection
                    if let analysis = ws.currentAnalysis {
                        deviceStatusSection(analysis)
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

    // MARK: - Sections

    private var headerSection: some View {
        VStack {
            Image(systemName: "nose.fill")
                .font(.system(size: 60))
                .foregroundColor(.blue)
            Text("OVLM-Powered Air Purification")
                .font(.title2)
                .fontWeight(.medium)
                .multilineTextAlignment(.center)
            Text("Server: \(AppConfig.serverURL.absoluteString)")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.top)
    }

    private var connectionSection: some View {
        HStack {
            Circle()
                .fill(ws.connectionStatus.color)
                .frame(width: 12, height: 12)
            Text(ws.connectionStatus.description)
                .font(.subheadline)
                .fontWeight(.medium)
            Spacer()
            if ws.connectionStatus == .disconnected {
                Button("Connect") { ws.connect() }
                    .buttonStyle(.borderedProminent)
            } else {
                Button("Disconnect") { ws.disconnect() }
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
                Button {
                    ws.isStreaming ? ws.stopStreaming() : ws.startStreaming()
                } label: {
                    Label(ws.isStreaming ? "Stop" : "Start",
                          systemImage: ws.isStreaming ? "pause.fill" : "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!ws.connectionStatus.isActive)

                Button("Sample Once") { ws.sampleOnce() }
                    .buttonStyle(.bordered)
                    .disabled(!ws.connectionStatus.isActive)
            }

            HStack {
                TextField("Ask OVLM a question...", text: $customQuery)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    ws.sendCustomQuery(customQuery)
                    customQuery = ""
                }
                .disabled(customQuery.isEmpty || !ws.connectionStatus.isActive)
            }
        }
    }

    private var analysisSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OVLM Analysis").font(.headline)
            Text(ws.lastMessage)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .font(.body)
        }
    }

    private func deviceStatusSection(_ analysis: OVLMAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Device Status").font(.headline)
            VStack(spacing: 8) {
                statusRow("Filter",
                          analysis.deviceActions.activateFilter ? "Active" : "Inactive",
                          analysis.deviceActions.activateFilter ? .green : .gray)
                statusRow("Mode",     analysis.deviceActions.filterMode.capitalized, .blue)
                statusRow("Duration", "\(analysis.deviceActions.durationMinutes) min", .orange)
                statusRow("Fan Speed","\(analysis.deviceActions.fanSpeed)%", .purple)
                statusRow("Alert",    "\(analysis.deviceActions.alertLevel)/10",
                          alertColor(analysis.deviceActions.alertLevel))
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
        }
    }

    private func rawMetricsSection(_ analysis: OVLMAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.easeInOut) { showingMetrics.toggle() }
            } label: {
                HStack {
                    Text("Technical Metrics").font(.headline)
                    Spacer()
                    Image(systemName: showingMetrics ? "chevron.up" : "chevron.down")
                }
                .foregroundColor(.primary)
            }

            if showingMetrics {
                VStack(spacing: 8) {
                    metricRow("Stress Confidence",
                              String(format: "%.0f%%", analysis.rawMetrics.stressConfidence * 100))
                    metricRow("Air Quality Score", "\(analysis.rawMetrics.airQualityScore)/10")
                    metricRow("Cortisol Estimate", analysis.rawMetrics.cortisolEstimate)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(12)
                .transition(.opacity)
            }
        }
    }

    // MARK: - Helpers

    private func statusRow(_ label: String, _ value: String, _ color: Color) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundColor(.secondary)
            Spacer()
            Text(value).font(.subheadline).fontWeight(.medium).foregroundColor(color)
        }
    }

    private func metricRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundColor(.secondary)
            Spacer()
            Text(value).font(.caption).fontWeight(.medium)
        }
    }

    private func alertColor(_ level: Int) -> Color {
        switch level {
        case 0...3: return .green
        case 4...6: return .orange
        default:    return .red
        }
    }
}

// MARK: - App Entry Point
@main
struct NoseFilterApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View { ContentView() }
}
