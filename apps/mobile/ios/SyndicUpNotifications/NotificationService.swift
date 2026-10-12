import UserNotifications

/// Extension de service (mutable-content) : télécharge `image_url` (photo d'incident, affiche
/// d'annonce) et l'attache à la bannière APNs. Sans image ou en cas d'échec, la bannière passe
/// telle quelle. Cible Xcode à créer : voir README.md.
final class NotificationService: UNNotificationServiceExtension {
  private var handler: ((UNNotificationContent) -> Void)?
  private var content: UNMutableNotificationContent?

  override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
    handler = contentHandler
    content = (request.content.mutableCopy() as? UNMutableNotificationContent)
    guard let content = content else { return contentHandler(request.content) }
    // Le payload complet sert aux boutons (flutter_local_notifications lit `payload`).
    if content.userInfo["payload"] == nil, let data = try? JSONSerialization.data(withJSONObject: content.userInfo.filter { ($0.key as? String) != "aps" }), let json = String(data: data, encoding: .utf8) {
      content.userInfo["payload"] = json
    }
    guard let raw = content.userInfo["image_url"] as? String, let url = URL(string: raw) else { return contentHandler(content) }
    let task = URLSession.shared.downloadTask(with: url) { tmp, _, _ in
      defer { contentHandler(content) }
      guard let tmp = tmp else { return }
      let ext = raw.lowercased().contains(".png") ? "png" : "jpg"
      let dest = FileManager.default.temporaryDirectory.appendingPathComponent("push-\(UUID().uuidString).\(ext)")
      try? FileManager.default.moveItem(at: tmp, to: dest)
      if let att = try? UNNotificationAttachment(identifier: "image", url: dest) { content.attachments = [att] }
    }
    task.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let content = content { handler?(content) }
  }
}
