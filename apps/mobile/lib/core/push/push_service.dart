import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../api/api_client.dart';
import '../config/app_config.dart';
import '../i18n/mobile_dict.dart';
import '../util/notifications_link.dart';
import 'niveaux.dart';

/// Notifications sur le téléphone (Master Spec 13.4) — bannières, alertes, écran verrouillé,
/// badge d'icône, actions, regroupement par fil — sur Android et iOS.
///
/// Deux sources, une seule mise en forme :
///  - **FCM** (push serveur, app en arrière-plan ou fermée) — activé quand un projet Firebase est
///    fourni au build (`--dart-define=FIREBASE_ENABLED=true` + clés). Le système affiche lui-même
///    le message (canal / niveau d'interruption calculés par l'API) ; au premier plan, l'app le
///    réaffiche en notification locale avec les mêmes règles.
///  - **Flux temps réel** (SSE, app ouverte ou juste mise en arrière-plan) — chaque événement
///    devient une notification système quand l'app n'est pas au premier plan, ou toujours quand
///    il est URGENT (alerte « heads-up » même l'app ouverte). Sans Firebase, c'est ce chemin qui
///    porte les bannières et l'écran verrouillé.
///
/// Niveaux (voir niveaux.dart) : URGENT = canal importance MAX + `time-sensitive` iOS, son et
/// vibration, visible verrouillé, jamais filtré ; NORMAL = bannière + son ; INFO = bannière
/// discrète sans son ; SILENCIEUX = synchronisation du badge, rien d'affiché.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static const _badgeChannel = MethodChannel('ma.syndicup.app/badge');
  static const categorieIos = 'SYNDICUP_NOTIFICATION';
  static const actionOuvrir = 'OUVRIR';
  static const actionMarquerLu = 'MARQUER_LU';

  final _local = FlutterLocalNotificationsPlugin();
  bool _localPret = false;
  bool _firebasePret = false;
  String? _token;
  MobileDict _d = MobileDict.fr;
  AppLifecycleListener? _lifecycle;

  /// Vrai quand l'app est visible : on privilégie alors le toast in-app (sauf URGENT).
  bool enAvantPlan = true;

  /// Le flux temps réel est connecté : un push FCM au premier plan n'est pas réaffiché (doublon).
  bool fluxConnecte = false;

  /// Identifiants déjà affichés (FCM et flux portent la même notification).
  final _vus = <String>{};
  final _ordreVus = <String>[];

  void Function(String path)? onOpen;
  Future<void> Function(String notificationId)? onMarquerLu;

  /// Chemin demandé par la notification qui a lancé l'app (consommé une fois par la coque).
  String? _cheminInitial;

  bool get firebaseActif => AppConfig.pushEnabled && AppConfig.firebaseAppId.isNotEmpty;
  bool get pret => _localPret;

  Future<void> init({Locale? locale}) async {
    _d = MobileDict.of(locale ?? const Locale('fr'));
    try {
      _lifecycle ??= AppLifecycleListener(onStateChange: (s) => enAvantPlan = s == AppLifecycleState.resumed);
    } catch (_) {}
    await _initLocal();
    await _initFirebase();
  }

  // ── Notifications locales (toujours disponibles) ──────────────────────────
  Future<void> _initLocal() async {
    if (_localPret) return;
    try {
      const androidInit = AndroidInitializationSettings('@drawable/ic_stat_syndicup');
      final iosInit = DarwinInitializationSettings(
        // La permission est demandée après la connexion (contexte explicite), pas au lancement.
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
        notificationCategories: [
          DarwinNotificationCategory(categorieIos, actions: [
            DarwinNotificationAction.plain(actionOuvrir, _d.open, options: {DarwinNotificationActionOption.foreground}),
            DarwinNotificationAction.plain(actionMarquerLu, _d.pushMarquerLu, options: {DarwinNotificationActionOption.foreground}),
          ], options: {DarwinNotificationCategoryOption.hiddenPreviewShowTitle}),
        ],
      );
      await _local.initialize(
        InitializationSettings(android: androidInit, iOS: iosInit),
        onDidReceiveNotificationResponse: _onReponse,
      );
      final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (android != null) {
        await android.createNotificationChannelGroup(const AndroidNotificationChannelGroup('syndicup', 'SyndicUp'));
        for (final c in _canaux) {
          await android.createNotificationChannel(AndroidNotificationChannel(
            c.id, c.nom,
            description: c.description,
            importance: c.importance,
            playSound: c.son,
            enableVibration: c.son,
            showBadge: c.id != canalAndroidPour(niveauSilencieux),
            groupId: 'syndicup',
          ));
        }
      }
      final lancement = await _local.getNotificationAppLaunchDetails();
      if (lancement?.didNotificationLaunchApp == true) {
        final p = _payload(lancement!.notificationResponse?.payload);
        _cheminInitial = p['path'];
      }
      _localPret = true;
    } catch (e) {
      debugPrint('Notifications locales indisponibles : $e');
    }
  }

  List<_Canal> get _canaux => [
        _Canal(canalAndroidPour(niveauUrgent), _d.pushCanalUrgent, _d.pushCanalUrgentAide, Importance.max, true),
        _Canal(canalAndroidPour(niveauNormal), _d.pushCanalNormal, _d.pushCanalNormalAide, Importance.high, true),
        _Canal(canalAndroidPour(niveauInfo), _d.pushCanalInfo, _d.pushCanalInfoAide, Importance.defaultImportance, false),
        _Canal(canalAndroidPour(niveauSilencieux), _d.pushCanalSilencieux, _d.pushCanalSilencieuxAide, Importance.low, false),
      ];

  /// Demande l'autorisation système (Android 13+ POST_NOTIFICATIONS, iOS alerte + badge + son).
  /// Idempotent : le système ne redemande pas une fois répondu.
  Future<bool> demanderPermission() async {
    if (!_localPret) return false;
    try {
      if (Platform.isAndroid) {
        return await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission() ?? true;
      }
      if (Platform.isIOS) {
        final ok = await _local.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, badge: true, sound: true) ?? false;
        if (_firebasePret) await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
        return ok;
      }
    } catch (e) {
      debugPrint('Permission notifications : $e');
    }
    return false;
  }

  /// Affiche une notification système. `cle` = identifiant de la notification métier (dédoublonnage).
  Future<void> afficher({
    required String cle,
    String? titre,
    String? corps,
    required String niveau,
    required String fil,
    int? badge,
    bool son = true,
    String? path,
    String? notificationId,
  }) async {
    if (!_localPret || niveau == niveauSilencieux) return;
    if ((titre == null || titre.isEmpty) && (corps == null || corps.isEmpty)) return;
    if (!_marquerVu(cle)) return;
    final urgent = niveau == niveauUrgent;
    final info = niveau == niveauInfo;
    final canal = _canaux.firstWhere((c) => c.id == canalAndroidPour(niveau));
    final android = AndroidNotificationDetails(
      canal.id,
      canal.nom,
      channelDescription: canal.description,
      importance: canal.importance,
      priority: urgent ? Priority.max : info ? Priority.defaultPriority : Priority.high,
      // Contenu visible sur l'écran verrouillé (le résident voit qui est à sa porte sans déverrouiller).
      visibility: NotificationVisibility.public,
      category: urgent ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.message,
      playSound: son && !info,
      enableVibration: urgent || (son && !info),
      number: badge,
      groupKey: 'ma.syndicup.$fil',
      ticker: titre,
      color: const Color(0xFF4C6C5A),
      styleInformation: BigTextStyleInformation(corps ?? '', contentTitle: titre),
      actions: [
        AndroidNotificationAction(actionOuvrir, _d.open, showsUserInterface: true),
        if (notificationId != null) AndroidNotificationAction(actionMarquerLu, _d.pushMarquerLu, showsUserInterface: true, cancelNotification: true),
      ],
    );
    final ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: badge != null,
      presentSound: son && !info,
      badgeNumber: badge,
      threadIdentifier: fil,
      categoryIdentifier: categorieIos,
      interruptionLevel: urgent ? InterruptionLevel.timeSensitive : (info || !son) ? InterruptionLevel.passive : InterruptionLevel.active,
    );
    try {
      await _local.show(cle.hashCode, titre, corps, NotificationDetails(android: android, iOS: ios), payload: jsonEncode({'path': path, 'notification_id': notificationId}));
    } catch (e) {
      debugPrint('Affichage notification impossible : $e');
    }
  }

  /// Badge d'icône : iOS via le canal natif (l'API pose aussi `aps.badge`) ; Android = compteur
  /// sur les notifications actives (`number`). À 0, tout est effacé du centre de notifications.
  Future<void> setBadge(int n) async {
    if (Platform.isIOS) {
      try {
        await _badgeChannel.invokeMethod<void>('setBadge', n < 0 ? 0 : n);
      } catch (_) {}
    }
    if (n <= 0 && _localPret) {
      try {
        await _local.cancelAll();
      } catch (_) {}
    }
  }

  String? prendreCheminInitial() {
    final p = _cheminInitial;
    _cheminInitial = null;
    return p;
  }

  bool _marquerVu(String cle) {
    if (cle.isEmpty) return true;
    if (_vus.contains(cle)) return false;
    _vus.add(cle);
    _ordreVus.add(cle);
    if (_ordreVus.length > 200) _vus.remove(_ordreVus.removeAt(0));
    return true;
  }

  Map<String, String?> _payload(String? raw) {
    if (raw == null || raw.isEmpty) return const {};
    try {
      final j = jsonDecode(raw);
      if (j is Map) return {'path': j['path']?.toString(), 'notification_id': j['notification_id']?.toString()};
    } catch (_) {}
    return {'path': raw};
  }

  void _onReponse(NotificationResponse r) {
    final p = _payload(r.payload);
    if (r.actionId == actionMarquerLu) {
      final id = p['notification_id'];
      if (id != null && id.isNotEmpty) onMarquerLu?.call(id);
      return;
    }
    final path = p['path'];
    if (path != null && path.isNotEmpty) onOpen?.call(path);
  }

  // ── FCM ────────────────────────────────────────────────────────────────────
  Future<void> _initFirebase() async {
    if (!firebaseActif || _firebasePret) return;
    try {
      await Firebase.initializeApp(
        options: FirebaseOptions(
          apiKey: AppConfig.firebaseApiKey,
          appId: AppConfig.firebaseAppId,
          messagingSenderId: AppConfig.firebaseSenderId,
          projectId: AppConfig.firebaseProjectId,
        ),
      );
      final fm = FirebaseMessaging.instance;
      if (Platform.isIOS) await fm.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
      FirebaseMessaging.onMessage.listen(_onMessageFcm);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data));
      final initial = await fm.getInitialMessage();
      if (initial != null) _cheminInitial = _pathFor(initial.data);
      fm.onTokenRefresh.listen((t) => _token = t);
      _firebasePret = true;
    } catch (e) {
      debugPrint('Push FCM désactivé : $e');
    }
  }

  Future<void> _onMessageFcm(RemoteMessage m) async {
    final data = m.data;
    final template = data['template_code']?.toString() ?? '';
    final niveau = niveauPour(data['niveau']?.toString(), template);
    final badge = int.tryParse(data['badge']?.toString() ?? '');
    if (niveau == niveauSilencieux) {
      if (badge != null) await setBadge(badge);
      return;
    }
    // Au premier plan avec le flux connecté, l'événement arrive aussi par le flux (toast in-app) :
    // on ne double pas la bannière, sauf URGENT (alerte visible dans tous les cas).
    if (enAvantPlan && fluxConnecte && niveau != niveauUrgent) return;
    final n = m.notification;
    await afficher(
      cle: data['notification_id']?.toString() ?? m.messageId ?? '${m.hashCode}',
      titre: n?.title ?? data['titre']?.toString(),
      corps: n?.body ?? data['corps']?.toString(),
      niveau: niveau,
      fil: filPour(data['fil']?.toString(), template),
      badge: badge,
      son: data['son'] != '0',
      path: _pathFor(data),
      notificationId: data['notification_id']?.toString(),
    );
  }

  String _pathFor(Map<String, dynamic> data) {
    final template = data['template_code']?.toString() ?? data['templateCode']?.toString() ?? '';
    return lienNotification(template, data.map((k, v) => MapEntry(k, v)));
  }

  void _open(Map<String, dynamic> data) => onOpen?.call(_pathFor(data));

  /// Enregistre le jeton d'appareil côté API (idempotent : même jeton → même ligne).
  Future<void> registerToken(ApiClient api, {required String langue}) async {
    if (!_firebasePret) return;
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
    if (!_firebasePret || t == null) return;
    await api.delete<dynamic>('/users/me/appareils/${Uri.encodeComponent(t)}');
  }
}

class _Canal {
  final String id, nom, description;
  final Importance importance;
  final bool son;
  const _Canal(this.id, this.nom, this.description, this.importance, this.son);
}
