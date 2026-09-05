import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'database.g.dart';

/// File d'attente locale des visites (Master Spec 11.4 / 13.3) — SEULE entité offline du
/// produit : écriture optimiste, retry automatique, résolution « dernière écriture gagne ».
/// Ne jamais répliquer ce pattern sur une entité financière ou probante (lib/offline/README.md).
///
/// `id` est aussi l'Idempotency-Key envoyée à `POST /visites` : un retry ne crée jamais de
/// doublon côté serveur.
class VisitesQueue extends Table {
  TextColumn get id => text()();
  TextColumn get coproprieteId => text()();
  TextColumn get lotId => text()();
  TextColumn get lotNumero => text().nullable()();
  TextColumn get visiteurNom => text()();
  DateTimeColumn get creeLe => dateTime()();
  IntColumn get tentatives => integer().withDefault(const Constant(0))();
  TextColumn get derniereErreur => text().nullable()();
  /// EN_ATTENTE (à envoyer) · ECHEC_DEFINITIF (payload refusé par le serveur, à corriger).
  TextColumn get statut => text().withDefault(const Constant('EN_ATTENTE'))();

  @override
  Set<Column> get primaryKey => {id};
}

/// Cache de lecture du gardien (lots + visites du jour) pour consulter le planning hors-ligne.
class CacheEntries extends Table {
  TextColumn get cle => text()();
  TextColumn get json => text()();
  DateTimeColumn get misAJourLe => dateTime()();

  @override
  Set<Column> get primaryKey => {cle};
}

@DriftDatabase(tables: [VisitesQueue, CacheEntries])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase([QueryExecutor? executor]) : super(executor ?? driftDatabase(name: 'syndicup_offline'));

  @override
  int get schemaVersion => 1;

  Stream<List<VisitesQueueData>> watchQueue() =>
      (select(visitesQueue)..orderBy([(t) => OrderingTerm.asc(t.creeLe)])).watch();

  Future<List<VisitesQueueData>> pending() =>
      (select(visitesQueue)..where((t) => t.statut.equals('EN_ATTENTE'))..orderBy([(t) => OrderingTerm.asc(t.creeLe)])).get();

  Future<void> enqueue(VisitesQueueCompanion v) => into(visitesQueue).insert(v, mode: InsertMode.insertOrReplace);

  Future<void> remove(String id) => (delete(visitesQueue)..where((t) => t.id.equals(id))).go();

  Future<void> markFailure(String id, String erreur, {bool definitif = false}) =>
      (update(visitesQueue)..where((t) => t.id.equals(id))).write(VisitesQueueCompanion(
        derniereErreur: Value(erreur),
        tentatives: Value.absent(),
        statut: Value(definitif ? 'ECHEC_DEFINITIF' : 'EN_ATTENTE'),
      ));

  Future<void> bumpAttempts(String id) => customUpdate(
        'UPDATE visites_queue SET tentatives = tentatives + 1 WHERE id = ?',
        variables: [Variable.withString(id)],
        updates: {visitesQueue},
      );

  Future<void> putCache(String cle, String json) =>
      into(cacheEntries).insert(CacheEntriesCompanion(cle: Value(cle), json: Value(json), misAJourLe: Value(DateTime.now())), mode: InsertMode.insertOrReplace);

  Future<CacheEntry?> getCache(String cle) => (select(cacheEntries)..where((t) => t.cle.equals(cle))).getSingleOrNull();
}
