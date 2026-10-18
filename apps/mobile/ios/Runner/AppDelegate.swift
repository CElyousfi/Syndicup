import Flutter
import UIKit
import flutter_local_notifications
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  // Live Activities (M26) — ios/Runner/LiveActivityBridge.swift.
  private let liveActivities = LiveActivityBridge()

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Actions de notification « sans interface » (porte, marquer lu) : exécutées dans un isolate
    // d'arrière-plan qui doit enregistrer ses propres plugins (trousseau, préférences, notifications
    // locales) — sinon MissingPluginException (documentation flutter_local_notifications, iOS).
    FlutterLocalNotificationsPlugin.setPluginRegistrantCallback { registry in
      GeneratedPluginRegistrant.register(with: registry)
    }
    GeneratedPluginRegistrant.register(with: self)
    // Notifications locales / FCM : bannières au premier plan, actions, écran verrouillé.
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
    }
    // Badge d'icône piloté par l'app (compteur de non lues) — canal natif « ma.syndicup.app/badge ».
    if let controller = window?.rootViewController as? FlutterViewController {
      liveActivities.attach(to: controller.binaryMessenger)
      SpotlightBridge.shared.attach(to: controller.binaryMessenger)
      let badge = FlutterMethodChannel(name: "ma.syndicup.app/badge", binaryMessenger: controller.binaryMessenger)
      badge.setMethodCallHandler { call, result in
        guard call.method == "setBadge" else { result(FlutterMethodNotImplemented); return }
        let n = (call.arguments as? Int) ?? 0
        if #available(iOS 16.0, *) {
          UNUserNotificationCenter.current().setBadgeCount(n) { _ in result(nil) }
        } else {
          UIApplication.shared.applicationIconBadgeNumber = n
          result(nil)
        }
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Spotlight : un résultat touché ouvre l'objet dans l'app (route poussée à Flutter).
  override func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    if SpotlightBridge.shared.traiter(activity: userActivity) { return true }
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }
}
