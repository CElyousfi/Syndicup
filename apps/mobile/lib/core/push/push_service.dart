import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uuid/uuid.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/session.dart';
import '../config/app_config.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../util/notifications_link.dart';
import 'niveaux.dart';

/// Notifications sur le téléphone (Master Spec 13.4) — bannières, alertes, écran verrouillé,
/// badge d'icône, **boutons d'action**, **regroupement par résidence**, **image en grand** —
/// sur Android et iOS.
///
/// Deux sources, une seule mise en forme :
///  - **FCM** (push serveur). Sur Android le serveur n'envoie que des données : c'est l'app qui
///    construit la bannière, au premier plan comme en arrière-plan ([pushBackgroundHandler],
///    isolate dédié) — c'est ce qui permet les boutons, le regroupement et l'image. Sur iOS, le
///    système affiche l'alerte APNs (catégorie = jeu de boutons, `thread-id` = résidence).
///  - **Flux temps réel** (SSE, app ouverte) — chaque événement devient une notification système
///    quand l'app n'est pas visible, ou toujours quand il est URGENT.
///
/// Boutons (décidés côté serveur, `actions` dans les données — push-niveaux.ts) :
/// AUTORISER / REFUSER (porte : réponse sans ouvrir l'app), PAYER, VOTER, APPELER (prestataire),
/// VOIR, MARQUER_LU (sans ouvrir l'app).
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static const _badgeChannel = MethodChannel('ma.syndicup.app/badge');
  static const actionOuvrir = 'VOIR';
  static const actionMarquerLu = 'MARQUER_LU';
  static const actionsFond = {'AUTORISER', 'REFUSER', 'MARQUER_LU'};
  static const categoriesIos = ['AUTORISER', 'PAYER', 'VOTER', 'APPELER', 'VOIR'];

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

  /// Jeton FCM de l'appareil (Android : inscription aux activités en direct).
  String? get token => _token;
  static const canalDirect = 'syndicup_direct';

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
        notificationCategories: [for (final c in categoriesIos) _categorieIos(c)],
      );
      await _local.initialize(
        InitializationSettings(android: androidInit, iOS: iosInit),
        onDidReceiveNotificationResponse: _onReponse,
        onDidReceiveBackgroundNotificationResponse: pushBackgroundResponse,
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
        final r = lancement!.notificationResponse;
        _cheminInitial = _cheminPour(r?.actionId, _payload(r?.payload));
      }
      _localPret = true;
    } catch (e) {
      debugPrint('Notifications locales indisponibles : $e');
    }
  }

  /// Catégorie iOS = jeu de boutons ; le premier bouton la nomme (`SYNDICUP_<premier>`).
  DarwinNotificationCategory _categorieIos(String premiere) {
    final actions = switch (premiere) {
      'AUTORISER' => ['AUTORISER', 'REFUSER'],
      'PAYER' => ['PAYER', 'VOIR'],
      'VOTER' => ['VOTER', 'VOIR'],
      'APPELER' => ['APPELER', 'VOIR'],
      _ => ['VOIR', 'MARQUER_LU'],
    };
    return DarwinNotificationCategory(
      'SYNDICUP_$premiere',
      actions: [
        for (final a in actions)
          DarwinNotificationAction.plain(a, _libelleAction(a), options: {
            if (!actionsFond.contains(a)) DarwinNotificationActionOption.foreground,
            if (a == 'REFUSER') DarwinNotificationActionOption.destructive,
          }),
      ],
      options: {DarwinNotificationCategoryOption.hiddenPreviewShowTitle},
    );
  }

  String _libelleAction(String a) => switch (a) {
        'AUTORISER' => _d.pushAutoriser,
        'REFUSER' => _d.pushRefuser,
        'PAYER' => _d.pushPayer,
        'VOTER' => _d.pushVoter,
        'APPELER' => _d.pushAppeler,
        'MARQUER_LU' => _d.pushMarquerLu,
        _ => _d.open,
      };

  List<_Canal> get _canaux => [
        _Canal(canalAndroidPour(niveauUrgent), _d.pushCanalUrgent, _d.pushCanalUrgentAide, Importance.max, true),
        _Canal(canalAndroidPour(niveauNormal), _d.pushCanalNormal, _d.pushCanalNormalAide, Importance.high, true),
        _Canal(canalAndroidPour(niveauInfo), _d.pushCanalInfo, _d.pushCanalInfoAide, Importance.defaultImportance, false),
        _Canal(canalAndroidPour(niveauSilencieux), _d.pushCanalSilencieux, _d.pushCanalSilencieuxAide, Importance.low, false),
        // Activités en direct : notification persistante à progression, silencieuse, mise à jour sur place.
        _Canal(canalDirect, _d.pushCanalDirect, _d.pushCanalDirectAide, Importance.low, false),
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
  /// `actions` : boutons (ordre serveur) ; `donnees` : variables du template (visite_id, ag_id,
  /// prestataire_tel…) rejouées dans le payload pour exécuter l'action ; `groupe` : résidence.
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
    List<String> actions = const ['VOIR', 'MARQUER_LU'],
    Map<String, String> donnees = const {},
    String? groupeId,
    String? groupeNom,
    String? imageUrl,
  }) async {
    if (!_localPret || niveau == niveauSilencieux) return;
    if ((titre == null || titre.isEmpty) && (corps == null || corps.isEmpty)) return;
    if (!_marquerVu(cle)) return;
    final urgent = niveau == niveauUrgent;
    final info = niveau == niveauInfo;
    final canal = _canaux.firstWhere((c) => c.id == canalAndroidPour(niveau));
    final payload = jsonEncode({
      'path': path,
      'notification_id': notificationId,
      'visite_id': donnees['visite_id'],
      'ag_id': donnees['ag_id'],
      'lot_id': donnees['lot_id'],
      'tel': donnees['prestataire_tel'],
      'copro': groupeId,
    });
    final image = await _telechargerImage(imageUrl);
    final groupKey = groupeId != null ? 'ma.syndicup.copro.$groupeId' : 'ma.syndicup.$fil';
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
      groupKey: groupKey,
      subText: groupeNom,
      ticker: titre,
      color: const Color(0xFF1E7552),
      largeIcon: image != null ? FilePathAndroidBitmap(image) : null,
      styleInformation: image != null
          ? BigPictureStyleInformation(FilePathAndroidBitmap(image), contentTitle: titre, summaryText: corps, hideExpandedLargeIcon: true)
          : BigTextStyleInformation(corps ?? '', contentTitle: titre),
      actions: [
        for (final a in actions.take(3))
          if (a != 'MARQUER_LU' || notificationId != null)
            AndroidNotificationAction(
              a,
              _libelleAction(a),
              // Fond : exécuté sans ouvrir l'app (porte, marquer lu) ; sinon l'app s'ouvre au bon endroit.
              showsUserInterface: !actionsFond.contains(a),
              cancelNotification: actionsFond.contains(a) || a == 'PAYER' || a == 'VOTER',
              contextual: a == 'APPELER',
            ),
      ],
    );
    final ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: badge != null,
      presentSound: son && !info,
      badgeNumber: badge,
      threadIdentifier: groupeId != null ? 'copro:$groupeId' : fil,
      categoryIdentifier: 'SYNDICUP_${actions.isEmpty ? 'VOIR' : actions.first}',
      interruptionLevel: urgent ? InterruptionLevel.timeSensitive : (info || !son) ? InterruptionLevel.passive : InterruptionLevel.active,
      attachments: image != null ? [DarwinNotificationAttachment(image)] : null,
    );
    try {
      await _local.show(cle.hashCode, titre, corps, NotificationDetails(android: android, iOS: ios), payload: payload);
      // Android : une ligne « résumé » par résidence, pour que les bannières s'empilent proprement.
      if (Platform.isAndroid && groupeId != null) {
        await _local.show(
          groupKey.hashCode,
          groupeNom ?? 'SyndicUp',
          null,
          NotificationDetails(
            android: AndroidNotificationDetails(
              canal.id,
              canal.nom,
              channelDescription: canal.description,
              importance: canal.importance,
              groupKey: groupKey,
              setAsGroupSummary: true,
              playSound: false,
              enableVibration: false,
              color: const Color(0xFF1E7552),
              styleInformation: InboxStyleInformation(const [], contentTitle: groupeNom ?? 'SyndicUp'),
            ),
          ),
          payload: jsonEncode({'path': '/notifications'}),
        );
      }
    } catch (e) {
      debugPrint('Affichage notification impossible : $e');
    }
  }

  /// Image jointe (photo d'incident, affiche d'annonce) : téléchargée dans le cache, 6 s max,
  /// jamais bloquante — sans image, la bannière est textuelle.
  Future<String?> _telechargerImage(String? url) async {
    if (url == null || url.isEmpty) return null;
    try {
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 6));
      if (res.statusCode != 200 || res.bodyBytes.length > 4 * 1024 * 1024) return null;
      final dir = await getTemporaryDirectory();
      final ext = url.contains('.png') ? 'png' : 'jpg';
      final f = File('${dir.path}/push_${url.hashCode}.$ext');
      await f.writeAsBytes(res.bodyBytes);
      return f.path;
    } catch (_) {
      return null;
    }
  }

  /// Bannière construite depuis les données FCM (Android : seul chemin d'affichage ; iOS : au
  /// premier plan seulement — le système a déjà affiché l'alerte APNs en arrière-plan).
  Future<void> afficherDepuisPush(Map<String, dynamic> data, {bool arrierePlan = false}) async {
    // Mise à jour d'une activité en direct (Android) : la notification persistante, pas une bannière.
    if (data['activite_type'] != null) {
      if (arrierePlan) {
        _d = MobileDict.of(Locale(data['langue']?.toString().toLowerCase() == 'ar' ? 'ar' : 'fr'));
        await _initLocal();
      }
      Map<String, String> etat = const {};
      try {
        final j = jsonDecode(data['activite_etat']?.toString() ?? '{}');
        if (j is Map) etat = {for (final e in j.entries) e.key.toString(): e.value?.toString() ?? ''};
      } catch (_) {}
      await afficherActivite(
        type: data['activite_type'].toString(),
        objetId: data['activite_objet_id']?.toString() ?? '',
        etat: etat,
        titre: data['titre']?.toString() ?? '',
        corps: data['corps']?.toString() ?? '',
        fin: data['activite_fin'] == '1',
      );
      return;
    }
    final template = data['template_code']?.toString() ?? '';
    final niveau = niveauPour(data['niveau']?.toString(), template);
    final badge = int.tryParse(data['badge']?.toString() ?? '');
    if (niveau == niveauSilencieux) {
      if (badge != null) await setBadge(badge);
      return;
    }
    if (arrierePlan) {
      _d = MobileDict.of(Locale(data['langue']?.toString().toLowerCase() == 'ar' ? 'ar' : 'fr'));
      await _initLocal();
    } else if (fluxConnecte && niveau != niveauUrgent) {
      // Au premier plan avec le flux connecté, l'événement arrive aussi par le flux (toast in-app).
      return;
    }
    final donnees = {for (final e in data.entries) e.key: e.value?.toString() ?? ''};
    await afficher(
      cle: data['notification_id']?.toString() ?? data['cle_regroupement']?.toString() ?? '${data.hashCode}',
      titre: data['titre']?.toString(),
      corps: data['corps']?.toString(),
      niveau: niveau,
      fil: filPour(data['fil']?.toString(), template),
      badge: badge,
      son: data['son'] != '0',
      path: _pathFor(data),
      notificationId: data['notification_id']?.toString(),
      actions: (data['actions']?.toString() ?? '').split(',').where((a) => a.isNotEmpty).toList(),
      donnees: donnees,
      groupeId: data['copropriete_id']?.toString(),
      groupeNom: data['copropriete_nom']?.toString(),
      imageUrl: data['image_url']?.toString(),
    );
  }

  /// Notification persistante d'une activité en direct (Android) : progression, mise à jour sur
  /// place sans son (`onlyAlertOnce`), retirée 15 min après la fin (dernier état visible).
  Future<void> afficherActivite({required String type, required String objetId, required Map<String, String> etat, required String titre, required String corps, bool fin = false}) async {
    if (!_localPret || Platform.isIOS) return;
    final id = 'activite:$objetId'.hashCode;
    final progression = progressionActivite(type, etat);
    final path = switch (type) {
      'AG_SEANCE' => '/ag/$objetId/seance',
      'INCIDENT' => '/incidents/$objetId',
      _ => etat['lot_id'] != null ? '/lots/${etat['lot_id']}?onglet=finances' : '/finances/appels-de-fonds',
    };
    final android = AndroidNotificationDetails(
      canalDirect,
      _d.pushCanalDirect,
      channelDescription: _d.pushCanalDirectAide,
      importance: Importance.low,
      priority: Priority.low,
      ongoing: !fin,
      autoCancel: fin,
      onlyAlertOnce: true,
      showProgress: progression != null,
      maxProgress: 100,
      progress: ((progression ?? 0) * 100).round(),
      indeterminate: false,
      category: AndroidNotificationCategory.progress,
      visibility: NotificationVisibility.public,
      color: const Color(0xFF1E7552),
      // Dari en grande icône, dans la pose de l'état (il montre le reste à payer, rit quand c'est
      // réglé) : la notification se met à jour sur place, Dari change de pose avec elle.
      largeIcon: DrawableResourceAndroidBitmap('dari_n_${dariPoseActivite(type, etat)}'),
      subText: sousTitreActivite(type, etat, _d),
      styleInformation: BigTextStyleInformation(corps, contentTitle: titre),
      timeoutAfter: fin ? 15 * 60 * 1000 : null,
      actions: [AndroidNotificationAction('VOIR', _d.open, showsUserInterface: true)],
    );
    try {
      await _local.show(id, titre, corps, NotificationDetails(android: android), payload: jsonEncode({'path': path}));
    } catch (e) {
      debugPrint('Activité en direct : affichage impossible ($e)');
    }
  }

  Future<void> retirerActivite(String objetId) async {
    if (!_localPret) return;
    try {
      await _local.cancel('activite:$objetId'.hashCode);
    } catch (_) {}
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

  /// Payload d'une notification : JSON {path, notification_id, …} (locales) ou les données FCM
  /// complètes (alerte APNs affichée par le système — `template_code` présent).
  static Map<String, String?> _payload(String? raw) {
    if (raw == null || raw.isEmpty) return const {};
    try {
      final j = jsonDecode(raw);
      if (j is Map) {
        final m = {for (final e in j.entries) e.key.toString(): e.value?.toString()};
        if (m['template_code'] != null && m['path'] == null) {
          m['path'] = lienNotification(m['template_code']!, j.cast<String, dynamic>());
          m['tel'] ??= m['prestataire_tel'];
          m['copro'] ??= m['copropriete_id'];
        }
        return m;
      }
    } catch (_) {}
    return {'path': raw};
  }

  /// Chemin ouvert pour une action « avec interface » : Payer, Voter, Voir, ou la cible par défaut.
  static String? _cheminPour(String? action, Map<String, String?> p) {
    switch (action) {
      case 'PAYER':
        return p['lot_id'] != null ? '/lots/${p['lot_id']}?onglet=finances' : '/payer';
      case 'VOTER':
        return p['ag_id'] != null ? '/ag/${p['ag_id']}/seance' : (p['path'] ?? '/ag');
      default:
        final path = p['path'];
        return path != null && path.isNotEmpty ? path : null;
    }
  }

  void _onReponse(NotificationResponse r) {
    final p = _payload(r.payload);
    if (r.actionId == actionMarquerLu) {
      final id = p['notification_id'];
      if (id != null && id.isNotEmpty) onMarquerLu?.call(id);
      return;
    }
    if (r.actionId == 'APPELER') {
      final tel = p['tel'];
      if (tel != null && tel.isNotEmpty) {
        launchUrl(Uri(scheme: 'tel', path: tel.replaceAll(' ', '')));
        return;
      }
    }
    final path = _cheminPour(r.actionId, p);
    if (path != null) onOpen?.call(path);
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
      FirebaseMessaging.onMessage.listen((m) => afficherDepuisPush(m.data));
      // Android : données seules → l'app construit la bannière même fermée (isolate dédié).
      FirebaseMessaging.onBackgroundMessage(pushBackgroundHandler);
      FirebaseMessaging.onMessageOpenedApp.listen((m) => _open(m.data));
      final initial = await fm.getInitialMessage();
      if (initial != null) _cheminInitial = _pathFor(initial.data);
      fm.onTokenRefresh.listen((t) => _token = t);
      _firebasePret = true;
    } catch (e) {
      debugPrint('Push FCM désactivé : $e');
    }
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

  // ── Actions exécutées sans ouvrir l'app ────────────────────────────────────
  /// Porte (AUTORISER / REFUSER) et MARQUER_LU : un appel API direct avec la session stockée.
  /// Le statut HTTP est vérifié : jeton expiré → un rafraîchissement (rotation enregistrée dans le
  /// trousseau) puis un nouvel essai ; échec de la réponse à la porte → notification locale
  /// « Réponse non envoyée — touchez pour ouvrir » qui ouvre la visite (X-Request-Id journalisé).
  static Future<void> executerActionFond(String? action, Map<String, String?> p) async {
    if (action == null || !actionsFond.contains(action)) return;
    final porte = action == 'AUTORISER' || action == 'REFUSER';
    try {
      await _executerActionFond(action, p);
    } catch (e, st) {
      // Plugin absent dans l'isolate, trousseau illisible, JSON inattendu… : jamais silencieux —
      // pour la porte, le résident est prévenu que sa réponse n'est pas partie.
      debugPrint('Action de notification en arrière-plan : exception $e\n$st');
      if (porte && p['visite_id'] != null) await _signalerEchecPorte(p, null);
    }
  }

  static Future<void> _executerActionFond(String action, Map<String, String?> p) async {
    final storage = SessionStorage();
    final lue = await storage.read();
    final porte = action == 'AUTORISER' || action == 'REFUSER';
    if (lue == null) {
      if (porte && p['visite_id'] != null) await _signalerEchecPorte(p, null);
      return;
    }
    var session = lue;
    final base = AppConfig.apiBaseUrl;
    const uuid = Uuid();
    Map<String, String> entetes(Session s, String requestId, String? idempotencyKey) => {
          'Authorization': 'Bearer ${s.accessToken}',
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
          if ((p['copro'] ?? s.coproprieteId) != null) 'X-Copropriete-Id': (p['copro'] ?? s.coproprieteId)!,
        };

    // Rotation des jetons dans l'isolate (pas d'ApiClient ici) ; null si le refresh est refusé.
    Future<Session?> rafraichir(Session s) async {
      try {
        final r = await http
            .post(Uri.parse('$base/auth/refresh'), headers: {'Content-Type': 'application/json', 'X-Request-Id': uuid.v4()}, body: jsonEncode({'refresh_token': s.refreshToken}))
            .timeout(const Duration(seconds: 10));
        if (r.statusCode >= 300) return null;
        final data = (jsonDecode(r.body) as Map)['data'] as Map;
        final t = SessionTokens.fromJson(data.cast<String, dynamic>());
        final ns = s.copyWith(accessToken: t.accessToken, refreshToken: t.refreshToken);
        await storage.write(ns);
        return ns;
      } catch (e) {
        debugPrint('Action de notification : rafraîchissement impossible ($e)');
        return null;
      }
    }

    // Un appel avec un rafraîchissement au plus ; renvoie le dernier statut (0 = réseau).
    Future<(int, String)> appel(Uri uri, {Object? body, String? idempotencyKey}) async {
      var requestId = uuid.v4();
      try {
        var r = await http.patch(uri, headers: entetes(session, requestId, idempotencyKey), body: body == null ? null : jsonEncode(body)).timeout(const Duration(seconds: 10));
        if (r.statusCode == 401) {
          final ns = await rafraichir(session);
          if (ns == null) return (401, requestId);
          session = ns;
          requestId = uuid.v4();
          r = await http.patch(uri, headers: entetes(ns, requestId, idempotencyKey), body: body == null ? null : jsonEncode(body)).timeout(const Duration(seconds: 10));
        }
        return (r.statusCode, requestId);
      } catch (e) {
        debugPrint('Action de notification en arrière-plan impossible ($requestId) : $e');
        return (0, requestId);
      }
    }

    // Délai dépassé / réseau coupé / 422 « plus en attente » : la décision a peut-être été
    // enregistrée quand même. On relit l'état de la visite avant d'annoncer un échec.
    Future<bool> dejaDecidee(String visiteId, String statutVoulu) async {
      try {
        final r = await http.get(Uri.parse('$base/visites'), headers: entetes(session, uuid.v4(), null)).timeout(const Duration(seconds: 10));
        if (r.statusCode >= 300) return false;
        final data = (jsonDecode(r.body) as Map)['data'];
        if (data is! List) return false;
        final v = data.whereType<Map>().where((x) => x['id']?.toString() == visiteId).firstOrNull;
        return v != null && v['statut']?.toString() == statutVoulu;
      } catch (e) {
        debugPrint('Relecture de la visite impossible : $e');
        return false;
      }
    }

    if (action == 'MARQUER_LU' && p['notification_id'] != null) {
      final (st, rid) = await appel(Uri.parse('$base/notifications/${p['notification_id']}/read'));
      if (st >= 300 || st == 0) debugPrint('Marquer lu depuis la notification : échec $st ($rid)');
    } else if (porte && p['visite_id'] != null) {
      final visiteId = p['visite_id']!;
      final statutVoulu = action == 'AUTORISER' ? 'AUTORISE' : 'REFUSE';
      var (st, rid) = await appel(
        Uri.parse('$base/visites/$visiteId/statut'),
        body: {'statut': statutVoulu},
        // Clé déterministe (uuid v5 visite + action) : l'endpoint la rejoue (withTenantIdempotent) —
        // un retry de la même décision renvoie la réponse stockée au lieu d'un 422 ; la relecture
        // `dejaDecidee` reste le filet pour un retry sans clé ou une décision prise ailleurs.
        idempotencyKey: uuid.v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'syndicup:porte:$visiteId:$action'),
      );
      if ((st == 0 || st >= 500 || st == 422) && await dejaDecidee(visiteId, statutVoulu)) st = 200;
      if (st >= 300 || st == 0) {
        debugPrint('Réponse à la porte non envoyée : statut $st, X-Request-Id $rid');
        await _signalerEchecPorte(p, rid);
        return;
      }
      if (p['notification_id'] != null) {
        final (lu, ridLu) = await appel(Uri.parse('$base/notifications/${p['notification_id']}/read'));
        if (lu >= 300 || lu == 0) debugPrint('Marquer lu après réponse à la porte : échec $lu ($ridLu)');
      }
    }
  }

  /// Notification locale d'échec : la réponse au visiteur n'est pas partie — toucher ouvre la visite.
  static Future<void> _signalerEchecPorte(Map<String, String?> p, String? requestId) async {
    final svc = PushService.instance;
    try {
      final prefs = await SharedPreferences.getInstance();
      svc._d = MobileDict.of(Locale(prefs.getString('locale') == 'ar' ? 'ar' : 'fr'));
    } catch (e) {
      debugPrint('Langue indisponible dans l\'isolate de notification : $e');
    }
    try {
      await svc._initLocal();
      final visite = p['visite_id'];
      final ux = svc._d.ux;
      await svc.afficher(
        cle: 'porte-echec:$visite:${requestId ?? DateTime.now().millisecondsSinceEpoch}',
        titre: ux.doorFailTitle,
        corps: requestId == null ? ux.doorFailBody : '${ux.doorFailBody} (${requestId.substring(0, 8)})',
        niveau: niveauUrgent,
        fil: 'visites',
        path: visite != null ? '/visites/$visite' : '/visites',
        actions: const ['VOIR'],
        groupeId: p['copro'],
      );
    } catch (e) {
      // Dernier recours : même la notification d'échec n'a pas pu s'afficher.
      debugPrint('Notification « réponse non envoyée » impossible : $e');
    }
  }
}

/// Android — message FCM reçu app fermée / en arrière-plan : isolate dédié, l'app construit la
/// bannière (boutons, résidence, image). Doit être une fonction de premier niveau.
@pragma('vm:entry-point')
Future<void> pushBackgroundHandler(RemoteMessage m) async {
  try {
    await PushService.instance.afficherDepuisPush(m.data, arrierePlan: true);
  } catch (e) {
    debugPrint('Push en arrière-plan : $e');
  }
}

/// Bouton « sans interface » touché (AUTORISER / REFUSER / MARQUER_LU) — isolate dédié.
@pragma('vm:entry-point')
void pushBackgroundResponse(NotificationResponse r) {
  final p = PushService._payload(r.payload);
  // executerActionFond rattrape lui-même toute exception (jamais d'erreur non gérée dans l'isolate).
  PushService.executerActionFond(r.actionId, p).ignore();
}

class _Canal {
  final String id, nom, description;
  final Importance importance;
  final bool son;
  const _Canal(this.id, this.nom, this.description, this.importance, this.son);
}

/// Part accomplie d'une activité (0..1) — null si l'objet n'a pas de progression (AG sans résolution).
double? progressionActivite(String type, Map<String, String> etat) {
  switch (type) {
    case 'APPEL_DE_FONDS':
      return double.tryParse(etat['progression'] ?? '');
    case 'INCIDENT':
      final e = int.tryParse(etat['etape'] ?? '') ?? 0;
      final n = int.tryParse(etat['nb_etapes'] ?? '') ?? 3;
      return n > 0 ? (e / n).clamp(0, 1).toDouble() : null;
    case 'AG_SEANCE':
      final f = int.tryParse(etat['nb_finalisees'] ?? '') ?? 0;
      final n = int.tryParse(etat['nb_resolutions'] ?? '') ?? 0;
      return n > 0 ? (f / n).clamp(0, 1).toDouble() : null;
  }
  return null;
}

/// Pose de Dari pour une activité en direct — même règle que dariPose() côté iOS
/// (ios/SyndicUpWidgets/LiveActivityViews.swift) : terminé → il rit ; séance d'AG → il note ;
/// incident pris en charge → il travaille, sinon il réfléchit ; appel de fonds → il montre.
String dariPoseActivite(String type, Map<String, String> etat) {
  const fini = {'CLOTUREE', 'PAYE', 'RESOLU', 'FERME'};
  if (fini.contains(etat['statut'])) return 'laugh';
  return switch (type) {
    'AG_SEANCE' => 'type',
    'INCIDENT' => etat['statut'] == 'EN_COURS' ? 'type' : 'think',
    _ => 'point',
  };
}

/// Sous-titre court de la notification persistante (résolution n/N, reste à payer, étape).
String sousTitreActivite(String type, Map<String, String> etat, MobileDict d) {
  switch (type) {
    case 'AG_SEANCE':
      return etat['statut'] == 'CLOTUREE' ? d.liveTermine : fill(d.liveResolution, {'n': etat['ordre'] ?? '', 'total': etat['nb_resolutions'] ?? ''});
    case 'APPEL_DE_FONDS':
      return etat['statut'] == 'PAYE' ? d.livePaye : fill(d.liveReste, {'montant': etat['reste'] ?? ''});
    case 'INCIDENT':
      return fill(d.liveEtape, {'n': '${(int.tryParse(etat['etape'] ?? '') ?? 0) + 1}', 'total': etat['nb_etapes'] ?? '3'});
  }
  return '';
}
