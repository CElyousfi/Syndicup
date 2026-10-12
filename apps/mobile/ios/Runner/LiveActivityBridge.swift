import ActivityKit
import Flutter
import Foundation

/// Pont Flutter ↔ ActivityKit (canal `ma.syndicup.app/live`) : `start` crée l'activité et
/// renvoie son identifiant ; le jeton push de chaque activité est émis sur le flux
/// `ma.syndicup.app/live/tokens` (l'app l'inscrit côté API) ; `end` la termine.
/// Les mises à jour d'état arrivent ensuite par APNs (push-type liveactivity), sans l'app.
final class LiveActivityBridge: NSObject, FlutterStreamHandler {
  private var sink: FlutterEventSink?
  private var tasks: [String: Task<Void, Never>] = [:]

  func attach(to messenger: FlutterBinaryMessenger) {
    let method = FlutterMethodChannel(name: "ma.syndicup.app/live", binaryMessenger: messenger)
    method.setMethodCallHandler { [weak self] call, result in self?.handle(call, result: result) }
    FlutterEventChannel(name: "ma.syndicup.app/live/tokens", binaryMessenger: messenger).setStreamHandler(self)
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? { sink = events; return nil }
  func onCancel(withArguments arguments: Any?) -> FlutterError? { sink = nil; return nil }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard #available(iOS 16.1, *) else { result(nil); return }
    switch call.method {
    case "start":
      guard let a = call.arguments as? [String: Any], let type = a["type"] as? String, let objetId = a["objetId"] as? String else { result(FlutterError(code: "ARGS", message: "type/objetId", details: nil)); return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { result(nil); return }
      let etat = (a["etat"] as? [String: Any]) ?? [:]
      var state = SyndicUpActivityAttributes.ContentState()
      state.titre = a["titre"] as? String
      state.corps = a["corps"] as? String
      if let data = try? JSONSerialization.data(withJSONObject: etat), let decoded = try? JSONDecoder().decode(SyndicUpActivityAttributes.ContentState.self, from: data) {
        state = decoded
        state.titre = a["titre"] as? String
        state.corps = a["corps"] as? String
      }
      let attrs = SyndicUpActivityAttributes(type: type, objetId: objetId, residence: (a["residence"] as? String) ?? "SyndicUp", rtl: (a["rtl"] as? Bool) ?? false)
      let cle = "\(type):\(objetId)"
      // Une seule activité par objet : on termine l'ancienne.
      for act in Activity<SyndicUpActivityAttributes>.activities where act.attributes.objetId == objetId {
        Task { await act.end(nil, dismissalPolicy: .immediate) }
      }
      do {
        let activity: Activity<SyndicUpActivityAttributes>
        if #available(iOS 16.2, *) {
          activity = try Activity.request(attributes: attrs, content: .init(state: state, staleDate: nil), pushType: .token)
        } else {
          activity = try Activity.request(attributes: attrs, contentState: state, pushType: .token)
        }
        tasks[cle]?.cancel()
        tasks[cle] = Task { [weak self] in
          for await data in activity.pushTokenUpdates {
            let token = data.map { String(format: "%02x", $0) }.joined()
            DispatchQueue.main.async { self?.sink?(["cle": cle, "token": token]) }
          }
        }
        result(activity.id)
      } catch {
        result(FlutterError(code: "ACTIVITY", message: error.localizedDescription, details: nil))
      }
    case "end":
      let id = (call.arguments as? [String: Any])?["id"] as? String
      for act in Activity<SyndicUpActivityAttributes>.activities where id == nil || act.id == id {
        Task { await act.end(nil, dismissalPolicy: .immediate) }
      }
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}
