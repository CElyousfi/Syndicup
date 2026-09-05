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

/// File des confirmations LCD du gardien (M15 : arrivée / départ d'un séjour) — même pattern
/// que les visites : `id` = Idempotency-Key de `POST /lcd/sejours/{id}/{action}`, rejouée à
/// l'identique jusqu'au succès (jamais de doublon d'événement probant).
class LcdActionsQueue extends Table {
  TextColumn get id => text()();
  TextColumn get coproprieteId => text()();
  TextColumn get sejourId => text()();
  /// 'arrivee' | 'depart'
  TextColumn get action => text()();
  /// Corps JSON envoyé (ex. `{"nb_voyageurs_constate": 2}`), rejoué tel quel.
  TextColumn get payload => text().withDefault(const Constant('{}'))();
  /// Libellé d'affichage hors-ligne (« Voyageur → lot »).
  TextColumn get libelle => text().nullable()();
  DateTimeColumn get creeLe => dateTime()();
  IntColumn get tentatives => integer().withDefault(const Constant(0))();
  TextColumn get derniereErreur => text().nullable()();
  /// true = refusée par le serveur (transition impossible), à retirer manuellement.
  BoolColumn get definitif => boolean().withDefault(const Constant(false))();

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

@DriftDatabase(tables: [VisitesQueue, LcdActionsQueue, CacheEntries])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase([QueryExecutor? executor]) : super(executor ?? driftDatabase(name: 'syndicup_offline'));

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          // v2 (M15) : file des confirmations LCD — les lignes visites existantes sont conservées.
          if (from < 2) await m.createTable(lcdActionsQueue);
        },
      );

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

  // ── File LCD (M15) ──
  Stream<List<LcdActionsQueueData>> watchLcdQueue() =>
      (select(lcdActionsQueue)..orderBy([(t) => OrderingTerm.asc(t.creeLe)])).watch();

  Future<List<LcdActionsQueueData>> pendingLcd() =>
      (select(lcdActionsQueue)..where((t) => t.definitif.equals(false))..orderBy([(t) => OrderingTerm.asc(t.creeLe)])).get();

  Future<void> enqueueLcd(LcdActionsQueueCompanion v) => into(lcdActionsQueue).insert(v, mode: InsertMode.insertOrReplace);

  Future<void> removeLcd(String id) => (delete(lcdActionsQueue)..where((t) => t.id.equals(id))).go();

  Future<void> markLcdFailure(String id, String erreur, {bool definitif = false}) =>
      (update(lcdActionsQueue)..where((t) => t.id.equals(id))).write(LcdActionsQueueCompanion(derniereErreur: Value(erreur), definitif: Value(definitif)));

  Future<void> bumpLcdAttempts(String id) => customUpdate(
        'UPDATE lcd_actions_queue SET tentatives = tentatives + 1 WHERE id = ?',
        variables: [Variable.withString(id)],
        updates: {lcdActionsQueue},
      );

  Future<void> putCache(String cle, String json) =>
      into(cacheEntries).insert(CacheEntriesCompanion(cle: Value(cle), json: Value(json), misAJourLe: Value(DateTime.now())), mode: InsertMode.insertOrReplace);

  Future<CacheEntry?> getCache(String cle) => (select(cacheEntries)..where((t) => t.cle.equals(cle))).getSingleOrNull();
}
