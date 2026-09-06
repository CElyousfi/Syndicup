import 'dart:async';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../local_db/database.dart';
import 'visites_sync.dart';

/// File des pointages non envoyés — observée par « Mon dossier ».
final presencesQueueProvider = StreamProvider<List<PresencesQueueData>>((ref) {
  return ref.watch(localDatabaseProvider).watchPresencesQueue();
});

class PointageResult {
  final PresencePersonnel? presence;
  final ApiFail<PresencePersonnel>? refus;
  const PointageResult({this.presence, this.refus});
  bool get enFile => presence == null && refus == null;
}

/// Pointage de présence de l'employé (M20, Doc A §9.4) hors-ligne — même discipline que les
/// visites et les confirmations LCD (Master Spec 13.3) : ligne locale d'abord, envoi immédiat si
/// le réseau est là, rejeu au retour du réseau et périodiquement, **toujours avec la même
/// Idempotency-Key** (= id de la ligne). Côté serveur le pointage est un upsert par date : un
/// rejeu ne crée jamais un second enregistrement.
class PresenceSync extends Notifier<SyncStatus> {
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

  Future<PointageResult> pointer({String statut = 'PRESENT', String? commentaire, DateTime? jour}) async {
    final session = ref.read(sessionProvider);
    final id = _uuid.v4();
    final date = jourIso(jour ?? DateTime.now());
    await _db.enqueuePresence(PresencesQueueCompanion(
      id: Value(id),
      coproprieteId: Value(session?.coproprieteId ?? ''),
      date: Value(date),
      statut: Value(statut),
      commentaire: Value(commentaire),
      creeLe: Value(DateTime.now()),
    ));
    return _send(id, date, statut, commentaire, session?.coproprieteId);
  }

  Future<PointageResult> _send(String id, String date, String statut, String? commentaire, String? coproId) async {
    final api = ref.read(apiClientProvider);
    await _db.bumpPresenceAttempts(id);
    final res = await api.post<PresencePersonnel>(
      '/personnel/me/presence',
      body: {'date': date, 'statut': statut, if (commentaire != null && commentaire.isNotEmpty) 'commentaire': commentaire},
      idempotencyKey: id,
      coproprieteId: coproId,
      parse: (j) => PresencePersonnel.fromJson(asMap(j)),
    );
    switch (res) {
      case ApiOk<PresencePersonnel>(:final data):
        await _db.removePresence(id);
        state = SyncStatus(syncing: state.syncing, lastSuccess: DateTime.now());
        ref.invalidate(personnelProvider);
        return PointageResult(presence: data);
      case ApiFail<PresencePersonnel>(:final error, :final status):
        final definitif = status == 400 || status == 403 || status == 404 || status == 422;
        await _db.markPresenceFailure(id, '${error.code}: ${error.message}', definitif: definitif);
        return PointageResult(refus: definitif ? res : null);
    }
  }

  Future<void> flush() async {
    if (_busy) return;
    if (ref.read(sessionProvider) == null) return;
    final pending = await _db.pendingPresences();
    if (pending.isEmpty) return;
    _busy = true;
    state = SyncStatus(syncing: true, lastSuccess: state.lastSuccess);
    try {
      for (final q in pending) {
        final r = await _send(q.id, q.date, q.statut, q.commentaire, q.coproprieteId.isEmpty ? null : q.coproprieteId);
        if (r.presence == null) {
          final again = await _db.pendingPresences();
          if (again.any((x) => x.id == q.id && (x.derniereErreur?.startsWith('NETWORK') ?? false))) break;
        }
      }
    } finally {
      _busy = false;
      state = SyncStatus(syncing: false, lastSuccess: state.lastSuccess);
    }
  }

  Future<void> retirer(String id) => _db.removePresence(id);
}

final presenceSyncProvider = NotifierProvider<PresenceSync, SyncStatus>(PresenceSync.new);
