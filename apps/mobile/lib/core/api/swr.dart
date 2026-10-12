import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../auth/session.dart';
import 'api_client.dart';
import 'api_result.dart';

/// Lectures « stale-while-revalidate » (M26-F) : la dernière réponse connue s'affiche tout de
/// suite (< 300 ms, même hors-ligne), le réseau la rafraîchit en arrière-plan et l'écran se met à
/// jour seulement si quelque chose a changé.
///
/// Deux niveaux :
///  - **disque** (annonces, AG, lots, documents, incidents, notifications) — fichiers JSON dans le
///    répertoire de l'app, un par (copropriété, chemin, filtres), vidés à la déconnexion ;
///  - **mémoire seule** (`disque: false`) pour tout ce qui est financier : jamais écrit sur le
///    téléphone (règle lib/core/api/providers.dart — aucune donnée financière au-delà de l'écran),
///    mais instantané entre deux onglets.
class ReadCache {
  ReadCache._();
  static final ReadCache instance = ReadCache._();

  final _memoire = <String, String>{};
  Directory? _dir;
  Future<Directory?>? _ouverture;

  Future<Directory?> _dossier() {
    if (_dir != null) return Future.value(_dir);
    return _ouverture ??= () async {
      if (kIsWeb) return null;
      try {
        final base = await getApplicationSupportDirectory();
        final d = Directory('${base.path}/lectures');
        if (!await d.exists()) await d.create(recursive: true);
        return _dir = d;
      } catch (_) {
        return null;
      }
    }();
  }

  /// Nom de fichier stable : base64url de la clé (chemins courts), tronqué avec son empreinte.
  String _fichier(String cle) {
    final b = base64Url.encode(utf8.encode(cle)).replaceAll('=', '');
    return b.length <= 120 ? b : '${b.substring(0, 100)}_${cle.hashCode.toRadixString(16)}';
  }

  Future<String?> read(String cle, {required bool disque}) async {
    final m = _memoire[cle];
    if (m != null || !disque) return m;
    final d = await _dossier();
    if (d == null) return null;
    try {
      final f = File('${d.path}/${_fichier(cle)}.json');
      if (!await f.exists()) return null;
      final raw = await f.readAsString();
      _memoire[cle] = raw;
      return raw;
    } catch (_) {
      return null;
    }
  }

  Future<void> write(String cle, String raw, {required bool disque}) async {
    _memoire[cle] = raw;
    if (!disque) return;
    final d = await _dossier();
    if (d == null) return;
    try {
      await File('${d.path}/${_fichier(cle)}.json').writeAsString(raw, flush: false);
    } catch (_) {}
  }

  /// Déconnexion / changement de compte : plus rien de l'ancien utilisateur sur le téléphone.
  Future<void> clear() async {
    _memoire.clear();
    final d = await _dossier();
    if (d == null) return;
    try {
      if (await d.exists()) await d.delete(recursive: true);
      _dir = null;
      _ouverture = null;
    } catch (_) {}
  }
}

/// Lecture SWR pour un `FutureProvider` : renvoie le cache s'il existe (et revalide en arrière-plan,
/// `ref.invalidateSelf()` si la réponse a changé), sinon le réseau ; hors-ligne sans cache, l'erreur
/// réseau remonte comme avant (« Réessayer »).
Future<T> swr<T>(Ref ref, String path, {Map<String, Object?>? query, required T Function(dynamic json) parse, bool disque = true, String? coproprieteId}) async {
  final api = ref.watch(apiClientProvider);
  final copro = coproprieteId ?? ref.read(sessionProvider)?.coproprieteId ?? '';
  final cle = '$copro|$path|${jsonEncode(query ?? const {})}';
  final cache = ReadCache.instance;
  var vivant = true;
  ref.onDispose(() => vivant = false);

  final connu = await cache.read(cle, disque: disque);
  if (connu != null) {
    // Revalidation silencieuse : l'écran ne bouge que si le serveur dit autre chose.
    unawaited(api.get<dynamic>(path, query: query, coproprieteId: coproprieteId).then((r) async {
      if (r is! ApiOk<dynamic>) return;
      final raw = jsonEncode(r.data);
      if (raw == connu) return;
      await cache.write(cle, raw, disque: disque);
      if (vivant) ref.invalidateSelf();
    }).catchError((_) {}));
    try {
      return parse(jsonDecode(connu));
    } catch (_) {
      // Cache illisible (modèle qui a changé) : on repart du réseau.
    }
  }
  final r = await api.get<dynamic>(path, query: query, coproprieteId: coproprieteId);
  if (r is ApiOk<dynamic>) {
    unawaited(cache.write(cle, jsonEncode(r.data), disque: disque));
    return parse(r.data);
  }
  // Réseau tombé mais une copie existe (même illisible partiellement) : mieux vaut l'ancienne page.
  if (connu != null) return parse(jsonDecode(connu));
  final f = r as ApiFail<dynamic>;
  throw ApiException(f.error, f.status, requestId: f.requestId);
}
