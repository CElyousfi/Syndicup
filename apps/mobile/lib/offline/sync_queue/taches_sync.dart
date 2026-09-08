import 'dart:async';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/session.dart';
import '../local_db/database.dart';
import 'visites_sync.dart';

/// File des changements de statut de tâches non envoyés — observée par « Mes tâches ».
final tachesQueueProvider = StreamProvider<List<TachesQueueData>>((ref) {
  return ref.watch(localDatabaseProvider).watchTachesQueue();
});

class TacheStatutResult {
  final Tache? tache;
  final ApiFail<Tache>? refus;
  const TacheStatutResult({this.tache, this.refus});
  bool get enFile => tache == null && refus == null;
}

/// Statut d'une tâche par l'assigné(e) (M22, gardien hors-ligne) — même discipline que les visites
/// (Master Spec 13.3) : ligne locale d'abord, envoi immédiat si le réseau est là, rejeu au retour du
/// réseau et périodiquement. Le serveur est rejouable à l'identique (même statut → `deja`) : un rejeu
/// ne crée jamais une seconde transition ni une seconde occurrence de récurrence.
class TachesSync extends Notifier<SyncStatus> {
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

  Future<TacheStatutResult> changerStatut({required String tacheId, required String statut, String? commentaire, String? libelle}) async {
    final session = ref.read(sessionProvider);
    final id = _uuid.v4();
    await _db.enqueueTache(TachesQueueCompanion(
      id: Value(id),
      coproprieteId: Value(session?.coproprieteId ?? ''),
      tacheId: Value(tacheId),
      statut: Value(statut),
      commentaire: Value(commentaire),
      libelle: Value(libelle),
      creeLe: Value(DateTime.now()),
    ));
    return _send(id, tacheId, statut, commentaire, session?.coproprieteId);
  }

  Future<TacheStatutResult> _send(String id, String tacheId, String statut, String? commentaire, String? coproId) async {
    final api = ref.read(apiClientProvider);
    await _db.bumpTacheAttempts(id);
    final res = await api.post<Tache>(
      '/taches/$tacheId/statut',
      body: {'statut': statut, if (commentaire != null && commentaire.isNotEmpty) 'commentaire': commentaire},
      idempotencyKey: id,
      coproprieteId: coproId,
      parse: (j) => Tache.fromJson(asMap(j)),
    );
    switch (res) {
      case ApiOk<Tache>(:final data):
        await _db.removeTache(id);
        state = SyncStatus(syncing: state.syncing, lastSuccess: DateTime.now());
        ref.invalidate(mesTachesProvider);
        ref.invalidate(tacheProvider(tacheId));
        return TacheStatutResult(tache: data);
      case ApiFail<Tache>(:final error, :final status):
        final definitif = status == 400 || status == 403 || status == 404 || status == 422;
        await _db.markTacheFailure(id, '${error.code}: ${error.message}', definitif: definitif);
        return TacheStatutResult(refus: definitif ? res : null);
    }
  }

  Future<void> flush() async {
    if (_busy) return;
    if (ref.read(sessionProvider) == null) return;
    final pending = await _db.pendingTaches();
    if (pending.isEmpty) return;
    _busy = true;
    state = SyncStatus(syncing: true, lastSuccess: state.lastSuccess);
    try {
      for (final q in pending) {
        final r = await _send(q.id, q.tacheId, q.statut, q.commentaire, q.coproprieteId.isEmpty ? null : q.coproprieteId);
        if (r.tache == null) {
          final again = await _db.pendingTaches();
          if (again.any((x) => x.id == q.id && (x.derniereErreur?.startsWith('NETWORK') ?? false))) break;
        }
      }
    } finally {
      _busy = false;
      state = SyncStatus(syncing: false, lastSuccess: state.lastSuccess);
    }
  }

  Future<void> retirer(String id) => _db.removeTache(id);
}

final tachesSyncProvider = NotifierProvider<TachesSync, SyncStatus>(TachesSync.new);
