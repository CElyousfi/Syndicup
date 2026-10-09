import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

/// Drapeaux d'interface publics (GET /v1/config/client — `{ data: { flags: {...} } }`).
///
/// Règles (décision D1, docs/ALIVE_AUDIT.md) :
///  - la dernière valeur connue est gardée sur l'appareil et s'applique dès le démarrage ;
///  - serveur injoignable → dernière valeur connue ; installation neuve sans valeur → défaut ;
///  - rafraîchi au démarrage puis au retour au premier plan (au plus une fois par minute,
///    comme le cache serveur).
class ClientFlags {
  ClientFlags._();
  static final ClientFlags instance = ClientFlags._();

  static const String _prefix = 'flag.';
  static const Map<String, bool> defaults = {'alive_v1': true};

  final ValueNotifier<Map<String, bool>> values = ValueNotifier(Map.of(defaults));
  SharedPreferences? _prefs;
  DateTime? _lastFetch;

  bool get alive => values.value['alive_v1'] ?? defaults['alive_v1']!;

  /// Charge la dernière valeur connue (synchrone après `SharedPreferences.getInstance`).
  void load(SharedPreferences prefs) {
    _prefs = prefs;
    final m = Map.of(defaults);
    for (final k in defaults.keys) {
      final v = prefs.getBool('$_prefix$k');
      if (v != null) m[k] = v;
    }
    values.value = m;
  }

  /// Interroge le serveur sans bloquer : toute erreur garde la valeur courante.
  Future<void> refresh({Dio? dio, bool force = false}) async {
    final now = DateTime.now();
    if (!force && _lastFetch != null && now.difference(_lastFetch!) < const Duration(seconds: 60)) return;
    _lastFetch = now;
    try {
      final client = dio ?? Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl, connectTimeout: const Duration(seconds: 6), receiveTimeout: const Duration(seconds: 6), validateStatus: (_) => true));
      final r = await client.get<dynamic>('/config/client');
      final body = r.statusCode == 200 && r.data is Map ? r.data as Map : null;
      final data = body?['data'];
      final flags = data is Map ? data['flags'] : null;
      if (flags is! Map) return;
      final m = Map.of(values.value);
      for (final k in defaults.keys) {
        final v = flags[k];
        if (v is bool) {
          m[k] = v;
          await _prefs?.setBool('$_prefix$k', v);
        }
      }
      if (!mapEquals(m, values.value)) values.value = m;
    } catch (e) {
      // Réseau indisponible : la dernière valeur connue reste en vigueur.
      debugPrint('ClientFlags.refresh: $e');
    }
  }

  @visibleForTesting
  void debugSet(String key, bool v) => values.value = {...values.value, key: v};
}
