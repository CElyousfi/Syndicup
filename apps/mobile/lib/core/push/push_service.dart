import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/api_client.dart';
import '../config/app_config.dart';
import '../util/notifications_link.dart';

/// Notifications push (FCM — Master Spec 13.4). Activées uniquement quand un projet Firebase est
/// fourni au build (`--dart-define=FIREBASE_ENABLED=true` + clés) : sans lui, l'app fonctionne
/// intégralement via le centre de notifications in-app + le flux temps réel.
///
/// Le jeton d'appareil est enregistré côté API (`POST /users/me/appareils`) ; les push
/// reçus au premier plan sont affichés en notification locale ; un tap ouvre l'objet concerné
/// (deep-link : visite → réponse, incident → détail, AG → détail, appel de fonds → solde).
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  final _local = FlutterLocalNotificationsPlugin();
  bool _initialised = false;
  String? _token;
  void Function(String path)? onOpen;

  bool get enabled => AppConfig.pushEnabled && AppConfig.firebaseAppId.isNotEmpty;

  Future<void> init() async {
    if (!enabled || _initialised) return;
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: AppConfig.firebaseApiKey,
          appId: AppConfig.firebaseAppId,
          messagingSenderId: AppConfig.firebaseSenderId,
          projectId: AppConfig.firebaseProjectId,
        ),
      );
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      await _local.initialize(
        const InitializationSettings(android: androidInit, iOS: iosInit),
        onDidReceiveNotificationResponse: (r) {
          final p = r.payload;
          if (p != null && p.isNotEmpty) onOpen?.call(p);
        },
      );
      const channel = AndroidNotificationChannel('syndicup', 'SyndicUp', importance: Importance.high);
      await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);

      final fm = FirebaseMessaging.instance;
      await fm.requestPermission(alert: true, badge: true, sound: true);
      if (Platform.isIOS) await fm.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);

      FirebaseMessaging.onMessage.listen(_onForeground);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data));
      final initial = await fm.getInitialMessage();
      if (initial != null) _open(initial.data);
      fm.onTokenRefresh.listen((t) => _token = t);
      _initialised = true;
    } catch (e) {
      debugPrint('Push désactivé : $e');
    }
  }

  Future<void> _onForeground(RemoteMessage m) async {
    final n = m.notification;
    final title = n?.title ?? m.data['titre']?.toString();
    final body = n?.body ?? m.data['corps']?.toString();
    if (title == null && body == null) return;
    await _local.show(
      m.hashCode,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails('syndicup', 'SyndicUp', importance: Importance.high, priority: Priority.high),
        iOS: DarwinNotificationDetails(),
      ),
      payload: _pathFor(m.data),
    );
  }

  String _pathFor(Map<String, dynamic> data) {
    final template = data['template_code']?.toString() ?? data['templateCode']?.toString() ?? '';
    return lienNotification(template, data.map((k, v) => MapEntry(k, v)));
  }

  void _open(Map<String, dynamic> data) => onOpen?.call(_pathFor(data));

  /// Enregistre le jeton d'appareil côté API (idempotent : même jeton → même ligne).
  Future<void> registerToken(ApiClient api, {required String langue}) async {
    if (!_initialised) return;
    try {
      _token ??= await FirebaseMessaging.instance.getToken();
      final t = _token;
      if (t == null) return;
      await api.post<dynamic>('/users/me/appareils', body: {
        'token': t,
        'plateforme': Platform.isIOS ? 'IOS' : 'ANDROID',
        'langue': langue,
        'version_app': AppConfig.appVersion,
      });
    } catch (e) {
      debugPrint('Enregistrement du jeton push impossible : $e');
    }
  }

  Future<void> unregisterToken(ApiClient api) async {
    final t = _token;
    if (!_initialised || t == null) return;
    await api.delete<dynamic>('/users/me/appareils/${Uri.encodeComponent(t)}');
  }
}
