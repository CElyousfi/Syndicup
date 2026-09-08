import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    // Notifications locales / FCM : bannières au premier plan, actions, écran verrouillé.
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
    }
    // Badge d'icône piloté par l'app (compteur de non lues) — canal natif « ma.syndicup.app/badge ».
    if let controller = window?.rootViewController as? FlutterViewController {
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
}
