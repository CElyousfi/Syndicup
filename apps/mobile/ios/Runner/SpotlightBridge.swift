import CoreSpotlight
import Flutter
import Foundation
import MobileCoreServices

/// Spotlight (canal `ma.syndicup.app/spotlight` : index / clear) et routes « système » vers
/// Flutter (flux `ma.syndicup.app/routes`) — résultat Spotlight touché, intention Siri exécutée.
final class SpotlightBridge: NSObject, FlutterStreamHandler {
  static let shared = SpotlightBridge()
  private var sink: FlutterEventSink?
  private var enAttente: String?

  func attach(to messenger: FlutterBinaryMessenger) {
    FlutterMethodChannel(name: "ma.syndicup.app/spotlight", binaryMessenger: messenger).setMethodCallHandler { [weak self] call, result in
      switch call.method {
      case "index": self?.indexer((call.arguments as? [String: Any])?["items"] as? [[String: Any]] ?? [], result: result)
      case "clear": CSSearchableIndex.default().deleteAllSearchableItems { _ in result(nil) }
      default: result(FlutterMethodNotImplemented)
      }
    }
    FlutterEventChannel(name: "ma.syndicup.app/routes", binaryMessenger: messenger).setStreamHandler(self)
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    if let r = enAttente { events(r); enAttente = nil }
    return nil
  }
  func onCancel(withArguments arguments: Any?) -> FlutterError? { sink = nil; return nil }

  /// Route demandée par le système ; gardée si Flutter n'écoute pas encore (lancement à froid).
  func emettre(route: String) {
    if let s = sink { s(route) } else { enAttente = route }
  }

  private func indexer(_ items: [[String: Any]], result: @escaping FlutterResult) {
    let searchable: [CSSearchableItem] = items.compactMap { i in
      guard let id = i["id"] as? String, let titre = i["titre"] as? String, let route = i["route"] as? String else { return nil }
      let attr = CSSearchableItemAttributeSet(contentType: .item)
      attr.title = titre
      attr.contentDescription = i["sous_titre"] as? String
      attr.identifier = route
      attr.keywords = [titre, "SyndicUp"]
      let item = CSSearchableItem(uniqueIdentifier: id, domainIdentifier: "ma.syndicup.app.\(i["type"] as? String ?? "objet")", attributeSet: attr)
      item.expirationDate = Date().addingTimeInterval(30 * 24 * 3600)
      return item
    }
    let index = CSSearchableIndex.default()
    index.deleteAllSearchableItems { _ in
      index.indexSearchableItems(searchable) { err in result(err == nil ? nil : FlutterError(code: "SPOTLIGHT", message: err?.localizedDescription, details: nil)) }
    }
  }

  /// Résultat Spotlight touché : l'identifiant de l'attribut porte la route.
  func traiter(activity: NSUserActivity) -> Bool {
    guard activity.activityType == CSSearchableItemActionType, let route = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String else { return false }
    // Les items sont indexés avec `uniqueIdentifier` = "type:id" ; la route est dans attributeSet.identifier,
    // que Spotlight ne renvoie pas : on la reconstruit depuis l'identifiant.
    let parts = route.split(separator: ":", maxSplits: 1).map(String.init)
    guard parts.count == 2 else { return false }
    let r: String
    switch parts[0] {
    case "lot": r = "/lots/\(parts[1])"
    case "incident": r = "/incidents/\(parts[1])"
    case "annonce": r = "/affichage/\(parts[1])"
    case "document": r = "/documents"
    default: return false
    }
    emettre(route: r)
    return true
  }
}
