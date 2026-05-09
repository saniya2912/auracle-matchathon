import Foundation

/// Network configuration for the OVLM Bridge Server connection.
/// For simulator: use "localhost". For physical device: use your Mac's LAN IP
/// (find it with `ipconfig getifaddr en0` on macOS).
enum AppConfig {
    // Override via environment variable OVLM_SERVER_IP when testing on device
    static let serverHost: String = {
        if let envHost = ProcessInfo.processInfo.environment["OVLM_SERVER_IP"] {
            return envHost
        }
        #if targetEnvironment(simulator)
        return "localhost"
        #else
        // CHANGE THIS to your Mac's LAN IP when running on a physical device
        return "192.168.1.100"
        #endif
    }()

    static let serverPort: Int = {
        if let envPort = ProcessInfo.processInfo.environment["OVLM_SERVER_PORT"],
           let port = Int(envPort) {
            return port
        }
        return 8765
    }()

    static var serverURL: URL {
        URL(string: "ws://\(serverHost):\(serverPort)")!
    }

    /// How long to wait before attempting a reconnect (seconds)
    static let reconnectDelay: TimeInterval = 3.0
    /// Maximum number of automatic reconnect attempts (0 = unlimited)
    static let maxReconnectAttempts: Int = 10
}
