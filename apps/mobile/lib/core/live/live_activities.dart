import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/api_result.dart';
import '../auth/session.dart';
import '../feel/haptics.dart';
import '../push/push_service.dart';

/// Activités en direct (M26) : le téléphone suit un objet — séance d'AG, ligne d'appel de fonds,
/// incident — et voit son avancement sans ouvrir l'app.
///  - iOS 16.1+ : Live Activity (écran verrouillé + île dynamique), via le pont natif
///    `ma.syndicup.app/live` (ActivityKit, ios/Runner/LiveActivityBridge.swift). Les mises à jour
///    arrivent par APNs directement dans l'activité : l'app n'a rien à faire.
///  - Android : notification persistante à progression (PushService.afficherActivite), mise à
///    jour par les pushs de données du serveur.
/// Dans les deux cas, l'inscription passe par `POST /users/me/appareils/activite`.
class LiveActivities {
  LiveActivities._();
  static final LiveActivities instance = LiveActivities._();

  static const _channel = MethodChannel('ma.syndicup.app/live');
  static const _tokens = EventChannel('ma.syndicup.app/live/tokens');
  static const _prefKey = 'live_activites';

  StreamSubscription<dynamic>? _sub;
  final _activites = <String, String>{}; // "type:objetId" → id d'activité iOS
  WidgetRef? _ref;

  bool get disponible => !kIsWeb && (Platform.isIOS || Platform.isAndroid);

  Future<void> init() async {
    if (!disponible || !Platform.isIOS) return;
    _sub ??= _tokens.receiveBroadcastStream().listen((e) {
      if (e is Map) _onToken(e['cle']?.toString(), e['token']?.toString());
    }, onError: (_) {});
  }

  /// Commence à suivre un objet. Idempotent : refaire l'appel rafraîchit l'état (et le jeton).
  Future<void> suivre(WidgetRef ref, {required String type, required String objetId, required Map<String, String> etat, required String titre, required String corps}) async {
    if (!disponible) return;
    _ref = ref;
    final cle = '$type:$objetId';
    try {
      if (Platform.isIOS) {
        final id = await _channel.invokeMethod<String>('start', {'type': type, 'objetId': objetId, 'etat': etat, 'titre': titre, 'corps': corps});
        if (id != null) _activites[cle] = id;
        // Le jeton ActivityKit arrive par le flux `tokens` → inscription côté API.
      } else {
        final token = PushService.instance.token;
        if (token == null) return;
        await _inscrire(ref, type: type, objetId: objetId, token: token, plateforme: 'ANDROID');
        await PushService.instance.afficherActivite(type: type, objetId: objetId, etat: etat, titre: titre, corps: corps);
      }
      Haptics.select();
    } catch (e) {
      debugPrint('Activité en direct : $e');
    }
  }

  Future<void> _onToken(String? cle, String? token) async {
    final ref = _ref;
    if (cle == null || token == null || ref == null) return;
    final i = cle.indexOf(':');
    if (i <= 0) return;
    await _inscrire(ref, type: cle.substring(0, i), objetId: cle.substring(i + 1), token: token, plateforme: 'IOS');
  }

  Future<void> _inscrire(WidgetRef ref, {required String type, required String objetId, required String token, required String plateforme}) async {
    if (ref.read(sessionProvider) == null) return;
    final r = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/users/me/appareils/activite', body: {'type': type, 'objet_id': objetId, 'token': token, 'plateforme': plateforme}, parse: asMap);
    if (r is ApiOk<Map<String, dynamic>>) {
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_prefKey) ?? [];
      final entree = '$type:$objetId=${r.data['id']}';
      if (!ids.contains(entree)) await prefs.setStringList(_prefKey, [...ids.where((x) => !x.startsWith('$type:$objetId=')), entree]);
    }
  }

  /// L'utilisateur ne suit plus l'objet (fermeture manuelle) : activité terminée, inscription retirée.
  Future<void> arreter(WidgetRef ref, {required String type, required String objetId}) async {
    if (!disponible) return;
    final cle = '$type:$objetId';
    try {
      if (Platform.isIOS) {
        final id = _activites.remove(cle);
        if (id != null) await _channel.invokeMethod<void>('end', {'id': id});
      } else {
        await PushService.instance.retirerActivite(objetId);
      }
      final prefs = await SharedPreferences.getInstance();
      final ids = prefs.getStringList(_prefKey) ?? [];
      final entree = ids.where((x) => x.startsWith('$cle=')).firstOrNull;
      if (entree != null) {
        await prefs.setStringList(_prefKey, ids.where((x) => x != entree).toList());
        await ref.read(apiClientProvider).delete<dynamic>('/users/me/appareils/activite/${entree.split('=').last}');
      }
    } catch (e) {
      debugPrint('Activité en direct (arrêt) : $e');
    }
  }
}
