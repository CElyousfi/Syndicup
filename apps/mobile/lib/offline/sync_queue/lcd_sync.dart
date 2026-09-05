import 'dart:async';
import 'dart:convert';

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

/// File des confirmations LCD (arrivée / départ) non envoyées — observée par l'écran LCD.
final lcdQueueProvider = StreamProvider<List<LcdActionsQueueData>>((ref) {
  return ref.watch(localDatabaseProvider).watchLcdQueue();
});

/// Résultat d'une confirmation : envoyée (`sejour`), refusée par le serveur (`refus`), ou en
/// file locale (les deux nuls) — l'écran choisit le toast en conséquence.
class LcdConfirmResult {
  final LcdSejour? sejour;
  final ApiFail<LcdSejour>? refus;
  const LcdConfirmResult({this.sejour, this.refus});
  bool get enFile => sejour == null && refus == null;
}

/// Confirmations d'arrivée / de départ du gardien (M15) hors-ligne — même discipline que les
/// visites (Master Spec 13.3) : file locale d'abord, envoi immédiat si le réseau est là, rejeu
/// au retour du réseau et périodiquement, **toujours avec la même Idempotency-Key** (= id de
/// la ligne) : un rejeu ne crée jamais un second événement probant côté serveur.
class LcdSync extends Notifier<SyncStatus> {
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

  /// Écriture optimiste : la ligne est en file avant tout appel réseau, puis envoyée.
  Future<LcdConfirmResult> confirmer({required String sejourId, required String action, Map<String, Object?> payload = const {}, String? libelle}) async {
    final session = ref.read(sessionProvider);
    final id = _uuid.v4();
    await _db.enqueueLcd(LcdActionsQueueCompanion(
      id: Value(id),
      coproprieteId: Value(session?.coproprieteId ?? ''),
      sejourId: Value(sejourId),
      action: Value(action),
      payload: Value(jsonEncode(payload)),
      libelle: Value(libelle),
      creeLe: Value(DateTime.now()),
    ));
    return _send(id, sejourId, action, payload, session?.coproprieteId);
  }

  Future<LcdConfirmResult> _send(String id, String sejourId, String action, Map<String, Object?> payload, String? coproId) async {
    final api = ref.read(apiClientProvider);
    await _db.bumpLcdAttempts(id);
    final res = await api.post<LcdSejour>(
      '/lcd/sejours/$sejourId/$action',
      body: payload,
      idempotencyKey: id,
      coproprieteId: coproId,
      parse: (j) => LcdSejour.fromJson(asMap(j)),
    );
    switch (res) {
      case ApiOk<LcdSejour>(:final data):
        await _db.removeLcd(id);
        state = SyncStatus(syncing: state.syncing, lastSuccess: DateTime.now());
        _invalidate(sejourId);
        return LcdConfirmResult(sejour: data);
      case ApiFail<LcdSejour>(:final error, :final status):
        // 400/403/404/422 = transition refusée (déjà confirmée, séjour annulé…) : inutile de
        // rejouer à l'identique. 409 = même clé, payload différent : conservée pour correction.
        final definitif = status == 400 || status == 403 || status == 404 || status == 422;
        await _db.markLcdFailure(id, '${error.code}: ${error.message}', definitif: definitif);
        if (definitif) _invalidate(sejourId);
        return LcdConfirmResult(refus: definitif ? res : null);
    }
  }

  void _invalidate(String sejourId) {
    ref.invalidate(lcdDuJourProvider);
    ref.invalidate(lcdSejoursProvider);
    ref.invalidate(lcdSejourProvider(sejourId));
  }

  /// Rejoue la file (retour du réseau, périodique, à la demande).
  Future<void> flush() async {
    if (_busy) return;
    if (ref.read(sessionProvider) == null) return;
    final pending = await _db.pendingLcd();
    if (pending.isEmpty) return;
    _busy = true;
    state = SyncStatus(syncing: true, lastSuccess: state.lastSuccess);
    try {
      for (final q in pending) {
        final payload = (jsonDecode(q.payload) as Map?)?.cast<String, Object?>() ?? const <String, Object?>{};
        final r = await _send(q.id, q.sejourId, q.action, payload, q.coproprieteId.isEmpty ? null : q.coproprieteId);
        if (r.sejour == null) {
          final again = await _db.pendingLcd();
          if (again.any((x) => x.id == q.id && (x.derniereErreur?.startsWith('NETWORK') ?? false))) break;
        }
      }
    } finally {
      _busy = false;
      state = SyncStatus(syncing: false, lastSuccess: state.lastSuccess);
    }
  }

  Future<void> retirer(String id) => _db.removeLcd(id);

  /// Cache de lecture du tableau du jour — consultable hors-ligne par le gardien.
  Future<void> cacheDuJour(LcdDuJour d) => _db.putCache('lcd_du_jour', jsonEncode(d.toJson()));
  Future<LcdDuJour?> cachedDuJour() async {
    final e = await _db.getCache('lcd_du_jour');
    if (e == null) return null;
    final j = jsonDecode(e.json);
    return j is Map ? LcdDuJour.fromJson(j.cast<String, dynamic>()) : null;
  }
}

final lcdSyncProvider = NotifierProvider<LcdSync, SyncStatus>(LcdSync.new);
