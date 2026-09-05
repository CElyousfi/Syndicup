import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/session.dart';
import '../local_db/database.dart';

final localDatabaseProvider = Provider<LocalDatabase>((ref) {
  final db = LocalDatabase();
  ref.onDispose(db.close);
  return db;
});

final connectivityProvider = StreamProvider<bool>((ref) async* {
  final c = Connectivity();
  bool online(List<ConnectivityResult> r) => r.any((x) => x != ConnectivityResult.none);
  yield online(await c.checkConnectivity());
  yield* c.onConnectivityChanged.map(online);
});

/// File des visites non envoyées (observée par l'écran gardien).
final visitesQueueProvider = StreamProvider<List<VisitesQueueData>>((ref) {
  return ref.watch(localDatabaseProvider).watchQueue();
});

class SyncStatus {
  final bool syncing;
  final DateTime? lastSuccess;
  const SyncStatus({this.syncing = false, this.lastSuccess});
}

/// Synchronisation des visites (Master Spec 13.3) :
///  1. toute écriture passe d'abord par la file locale (`enqueue`) ;
///  2. réseau disponible → envoi immédiat, retrait de la file au succès ;
///  3. réseau absent → persistance, retry automatique au retour du réseau et périodiquement
///     tant que l'app est ouverte (l'exécution en arrière-plan OS est listée en suite dans
///     docs/PARITE_WEB_MOBILE.md).
class VisitesSync extends Notifier<SyncStatus> {
  Timer? _timer;
  bool _busy = false;
  static const _uuid = Uuid();

  @override
  SyncStatus build() {
    ref.listen<AsyncValue<bool>>(connectivityProvider, (_, next) {
      if (next.valueOrNull == true) flush();
    });
    _timer = Timer.periodic(const Duration(seconds: 45), (_) => flush());
    ref.onDispose(() => _timer?.cancel());
    Future.microtask(flush);
    return const SyncStatus();
  }

  LocalDatabase get _db => ref.read(localDatabaseProvider);

  /// Écriture optimiste : la visite est visible localement immédiatement, puis envoyée.
  /// Retourne la visite serveur si l'envoi immédiat a réussi, null si elle reste en file.
  Future<Visite?> enregistrer({required String lotId, String? lotNumero, required String visiteurNom}) async {
    final session = ref.read(sessionProvider);
    final id = _uuid.v4();
    await _db.enqueue(VisitesQueueCompanion(
      id: Value(id),
      coproprieteId: Value(session?.coproprieteId ?? ''),
      lotId: Value(lotId),
      lotNumero: Value(lotNumero),
      visiteurNom: Value(visiteurNom),
      creeLe: Value(DateTime.now()),
    ));
    return _send(id, lotId, visiteurNom, session?.coproprieteId);
  }

  Future<Visite?> _send(String id, String lotId, String visiteurNom, String? coproId) async {
    final api = ref.read(apiClientProvider);
    await _db.bumpAttempts(id);
    final res = await api.post<Visite>(
      '/visites',
      body: {'lot_id': lotId, 'visiteur_nom': visiteurNom},
      idempotencyKey: id,
      coproprieteId: coproId,
      parse: (j) => Visite.fromJson(asMap(j)),
    );
    switch (res) {
      case ApiOk<Visite>(:final data):
        await _db.remove(id);
        state = SyncStatus(syncing: state.syncing, lastSuccess: DateTime.now());
        ref.invalidate(visitesProvider);
        return data;
      case ApiFail<Visite>(:final error, :final status):
        // Même clé rejouée avec le même payload → le serveur renvoie la réponse mémorisée
        // (succès). Un 409 signifie « même clé, payload différent » : on garde la ligne
        // pour correction. 400/403/404/422 = payload refusé, inutile de réessayer à l'identique.
        final definitif = status == 400 || status == 403 || status == 404 || status == 422;
        await _db.markFailure(id, '${error.code}: ${error.message}', definitif: definitif);
        return null;
    }
  }

  /// Rejoue la file (appelé au retour du réseau, périodiquement, et à la demande).
  Future<void> flush() async {
    if (_busy) return;
    if (ref.read(sessionProvider) == null) return;
    final pending = await _db.pending();
    if (pending.isEmpty) return;
    _busy = true;
    state = SyncStatus(syncing: true, lastSuccess: state.lastSuccess);
    try {
      for (final v in pending) {
        final ok = await _send(v.id, v.lotId, v.visiteurNom, v.coproprieteId.isEmpty ? null : v.coproprieteId);
        if (ok == null) {
          final again = await _db.pending();
          // Toujours en attente avec une erreur réseau : on arrête, le réseau est absent.
          if (again.any((x) => x.id == v.id && (x.derniereErreur?.startsWith('NETWORK') ?? false))) break;
        }
      }
    } finally {
      _busy = false;
      state = SyncStatus(syncing: false, lastSuccess: state.lastSuccess);
    }
  }

  Future<void> retirer(String id) => _db.remove(id);

  /// Lots (id, numéro, type) en cache pour le formulaire visiteur hors-ligne.
  Future<void> cacheLots(List<Lot> lots) =>
      cacheJson('lots', lots.map((x) => {'id': x.id, 'numero': x.numero, 'typeLot': x.typeLot}).toList());

  Future<List<({String id, String numero})>> cachedLots() async {
    final c = await cachedJson('lots');
    if (c is! List) return const [];
    return c.whereType<Map>().map((m) => (id: m['id'].toString(), numero: m['numero'].toString())).toList();
  }

  /// Cache de lecture (planning) — consultable hors-ligne.
  Future<void> cacheJson(String cle, Object value) => _db.putCache(cle, jsonEncode(value));
  Future<dynamic> cachedJson(String cle) async {
    final e = await _db.getCache(cle);
    return e == null ? null : jsonDecode(e.json);
  }
}

final visitesSyncProvider = NotifierProvider<VisitesSync, SyncStatus>(VisitesSync.new);
