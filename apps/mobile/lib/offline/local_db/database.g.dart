// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'database.dart';

// ignore_for_file: type=lint
class $VisitesQueueTable extends VisitesQueue
    with TableInfo<$VisitesQueueTable, VisitesQueueData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VisitesQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _coproprieteIdMeta = const VerificationMeta(
    'coproprieteId',
  );
  @override
  late final GeneratedColumn<String> coproprieteId = GeneratedColumn<String>(
    'copropriete_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lotIdMeta = const VerificationMeta('lotId');
  @override
  late final GeneratedColumn<String> lotId = GeneratedColumn<String>(
    'lot_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lotNumeroMeta = const VerificationMeta(
    'lotNumero',
  );
  @override
  late final GeneratedColumn<String> lotNumero = GeneratedColumn<String>(
    'lot_numero',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _visiteurNomMeta = const VerificationMeta(
    'visiteurNom',
  );
  @override
  late final GeneratedColumn<String> visiteurNom = GeneratedColumn<String>(
    'visiteur_nom',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _creeLeMeta = const VerificationMeta('creeLe');
  @override
  late final GeneratedColumn<DateTime> creeLe = GeneratedColumn<DateTime>(
    'cree_le',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _tentativesMeta = const VerificationMeta(
    'tentatives',
  );
  @override
  late final GeneratedColumn<int> tentatives = GeneratedColumn<int>(
    'tentatives',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _derniereErreurMeta = const VerificationMeta(
    'derniereErreur',
  );
  @override
  late final GeneratedColumn<String> derniereErreur = GeneratedColumn<String>(
    'derniere_erreur',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _statutMeta = const VerificationMeta('statut');
  @override
  late final GeneratedColumn<String> statut = GeneratedColumn<String>(
    'statut',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('EN_ATTENTE'),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    coproprieteId,
    lotId,
    lotNumero,
    visiteurNom,
    creeLe,
    tentatives,
    derniereErreur,
    statut,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'visites_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<VisitesQueueData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('copropriete_id')) {
      context.handle(
        _coproprieteIdMeta,
        coproprieteId.isAcceptableOrUnknown(
          data['copropriete_id']!,
          _coproprieteIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_coproprieteIdMeta);
    }
    if (data.containsKey('lot_id')) {
      context.handle(
        _lotIdMeta,
        lotId.isAcceptableOrUnknown(data['lot_id']!, _lotIdMeta),
      );
    } else if (isInserting) {
      context.missing(_lotIdMeta);
    }
    if (data.containsKey('lot_numero')) {
      context.handle(
        _lotNumeroMeta,
        lotNumero.isAcceptableOrUnknown(data['lot_numero']!, _lotNumeroMeta),
      );
    }
    if (data.containsKey('visiteur_nom')) {
      context.handle(
        _visiteurNomMeta,
        visiteurNom.isAcceptableOrUnknown(
          data['visiteur_nom']!,
          _visiteurNomMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_visiteurNomMeta);
    }
    if (data.containsKey('cree_le')) {
      context.handle(
        _creeLeMeta,
        creeLe.isAcceptableOrUnknown(data['cree_le']!, _creeLeMeta),
      );
    } else if (isInserting) {
      context.missing(_creeLeMeta);
    }
    if (data.containsKey('tentatives')) {
      context.handle(
        _tentativesMeta,
        tentatives.isAcceptableOrUnknown(data['tentatives']!, _tentativesMeta),
      );
    }
    if (data.containsKey('derniere_erreur')) {
      context.handle(
        _derniereErreurMeta,
        derniereErreur.isAcceptableOrUnknown(
          data['derniere_erreur']!,
          _derniereErreurMeta,
        ),
      );
    }
    if (data.containsKey('statut')) {
      context.handle(
        _statutMeta,
        statut.isAcceptableOrUnknown(data['statut']!, _statutMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  VisitesQueueData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return VisitesQueueData(
      id:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}id'],
          )!,
      coproprieteId:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}copropriete_id'],
          )!,
      lotId:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}lot_id'],
          )!,
      lotNumero: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}lot_numero'],
      ),
      visiteurNom:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}visiteur_nom'],
          )!,
      creeLe:
          attachedDatabase.typeMapping.read(
            DriftSqlType.dateTime,
            data['${effectivePrefix}cree_le'],
          )!,
      tentatives:
          attachedDatabase.typeMapping.read(
            DriftSqlType.int,
            data['${effectivePrefix}tentatives'],
          )!,
      derniereErreur: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}derniere_erreur'],
      ),
      statut:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}statut'],
          )!,
    );
  }

  @override
  $VisitesQueueTable createAlias(String alias) {
    return $VisitesQueueTable(attachedDatabase, alias);
  }
}

class VisitesQueueData extends DataClass
    implements Insertable<VisitesQueueData> {
  final String id;
  final String coproprieteId;
  final String lotId;
  final String? lotNumero;
  final String visiteurNom;
  final DateTime creeLe;
  final int tentatives;
  final String? derniereErreur;

  /// EN_ATTENTE (à envoyer) · ECHEC_DEFINITIF (payload refusé par le serveur, à corriger).
  final String statut;
  const VisitesQueueData({
    required this.id,
    required this.coproprieteId,
    required this.lotId,
    this.lotNumero,
    required this.visiteurNom,
    required this.creeLe,
    required this.tentatives,
    this.derniereErreur,
    required this.statut,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['copropriete_id'] = Variable<String>(coproprieteId);
    map['lot_id'] = Variable<String>(lotId);
    if (!nullToAbsent || lotNumero != null) {
      map['lot_numero'] = Variable<String>(lotNumero);
    }
    map['visiteur_nom'] = Variable<String>(visiteurNom);
    map['cree_le'] = Variable<DateTime>(creeLe);
    map['tentatives'] = Variable<int>(tentatives);
    if (!nullToAbsent || derniereErreur != null) {
      map['derniere_erreur'] = Variable<String>(derniereErreur);
    }
    map['statut'] = Variable<String>(statut);
    return map;
  }

  VisitesQueueCompanion toCompanion(bool nullToAbsent) {
    return VisitesQueueCompanion(
      id: Value(id),
      coproprieteId: Value(coproprieteId),
      lotId: Value(lotId),
      lotNumero:
          lotNumero == null && nullToAbsent
              ? const Value.absent()
              : Value(lotNumero),
      visiteurNom: Value(visiteurNom),
      creeLe: Value(creeLe),
      tentatives: Value(tentatives),
      derniereErreur:
          derniereErreur == null && nullToAbsent
              ? const Value.absent()
              : Value(derniereErreur),
      statut: Value(statut),
    );
  }

  factory VisitesQueueData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return VisitesQueueData(
      id: serializer.fromJson<String>(json['id']),
      coproprieteId: serializer.fromJson<String>(json['coproprieteId']),
      lotId: serializer.fromJson<String>(json['lotId']),
      lotNumero: serializer.fromJson<String?>(json['lotNumero']),
      visiteurNom: serializer.fromJson<String>(json['visiteurNom']),
      creeLe: serializer.fromJson<DateTime>(json['creeLe']),
      tentatives: serializer.fromJson<int>(json['tentatives']),
      derniereErreur: serializer.fromJson<String?>(json['derniereErreur']),
      statut: serializer.fromJson<String>(json['statut']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'coproprieteId': serializer.toJson<String>(coproprieteId),
      'lotId': serializer.toJson<String>(lotId),
      'lotNumero': serializer.toJson<String?>(lotNumero),
      'visiteurNom': serializer.toJson<String>(visiteurNom),
      'creeLe': serializer.toJson<DateTime>(creeLe),
      'tentatives': serializer.toJson<int>(tentatives),
      'derniereErreur': serializer.toJson<String?>(derniereErreur),
      'statut': serializer.toJson<String>(statut),
    };
  }

  VisitesQueueData copyWith({
    String? id,
    String? coproprieteId,
    String? lotId,
    Value<String?> lotNumero = const Value.absent(),
    String? visiteurNom,
    DateTime? creeLe,
    int? tentatives,
    Value<String?> derniereErreur = const Value.absent(),
    String? statut,
  }) => VisitesQueueData(
    id: id ?? this.id,
    coproprieteId: coproprieteId ?? this.coproprieteId,
    lotId: lotId ?? this.lotId,
    lotNumero: lotNumero.present ? lotNumero.value : this.lotNumero,
    visiteurNom: visiteurNom ?? this.visiteurNom,
    creeLe: creeLe ?? this.creeLe,
    tentatives: tentatives ?? this.tentatives,
    derniereErreur:
        derniereErreur.present ? derniereErreur.value : this.derniereErreur,
    statut: statut ?? this.statut,
  );
  VisitesQueueData copyWithCompanion(VisitesQueueCompanion data) {
    return VisitesQueueData(
      id: data.id.present ? data.id.value : this.id,
      coproprieteId:
          data.coproprieteId.present
              ? data.coproprieteId.value
              : this.coproprieteId,
      lotId: data.lotId.present ? data.lotId.value : this.lotId,
      lotNumero: data.lotNumero.present ? data.lotNumero.value : this.lotNumero,
      visiteurNom:
          data.visiteurNom.present ? data.visiteurNom.value : this.visiteurNom,
      creeLe: data.creeLe.present ? data.creeLe.value : this.creeLe,
      tentatives:
          data.tentatives.present ? data.tentatives.value : this.tentatives,
      derniereErreur:
          data.derniereErreur.present
              ? data.derniereErreur.value
              : this.derniereErreur,
      statut: data.statut.present ? data.statut.value : this.statut,
    );
  }

  @override
  String toString() {
    return (StringBuffer('VisitesQueueData(')
          ..write('id: $id, ')
          ..write('coproprieteId: $coproprieteId, ')
          ..write('lotId: $lotId, ')
          ..write('lotNumero: $lotNumero, ')
          ..write('visiteurNom: $visiteurNom, ')
          ..write('creeLe: $creeLe, ')
          ..write('tentatives: $tentatives, ')
          ..write('derniereErreur: $derniereErreur, ')
          ..write('statut: $statut')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    coproprieteId,
    lotId,
    lotNumero,
    visiteurNom,
    creeLe,
    tentatives,
    derniereErreur,
    statut,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VisitesQueueData &&
          other.id == this.id &&
          other.coproprieteId == this.coproprieteId &&
          other.lotId == this.lotId &&
          other.lotNumero == this.lotNumero &&
          other.visiteurNom == this.visiteurNom &&
          other.creeLe == this.creeLe &&
          other.tentatives == this.tentatives &&
          other.derniereErreur == this.derniereErreur &&
          other.statut == this.statut);
}

class VisitesQueueCompanion extends UpdateCompanion<VisitesQueueData> {
  final Value<String> id;
  final Value<String> coproprieteId;
  final Value<String> lotId;
  final Value<String?> lotNumero;
  final Value<String> visiteurNom;
  final Value<DateTime> creeLe;
  final Value<int> tentatives;
  final Value<String?> derniereErreur;
  final Value<String> statut;
  final Value<int> rowid;
  const VisitesQueueCompanion({
    this.id = const Value.absent(),
    this.coproprieteId = const Value.absent(),
    this.lotId = const Value.absent(),
    this.lotNumero = const Value.absent(),
    this.visiteurNom = const Value.absent(),
    this.creeLe = const Value.absent(),
    this.tentatives = const Value.absent(),
    this.derniereErreur = const Value.absent(),
    this.statut = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VisitesQueueCompanion.insert({
    required String id,
    required String coproprieteId,
    required String lotId,
    this.lotNumero = const Value.absent(),
    required String visiteurNom,
    required DateTime creeLe,
    this.tentatives = const Value.absent(),
    this.derniereErreur = const Value.absent(),
    this.statut = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       coproprieteId = Value(coproprieteId),
       lotId = Value(lotId),
       visiteurNom = Value(visiteurNom),
       creeLe = Value(creeLe);
  static Insertable<VisitesQueueData> custom({
    Expression<String>? id,
    Expression<String>? coproprieteId,
    Expression<String>? lotId,
    Expression<String>? lotNumero,
    Expression<String>? visiteurNom,
    Expression<DateTime>? creeLe,
    Expression<int>? tentatives,
    Expression<String>? derniereErreur,
    Expression<String>? statut,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (coproprieteId != null) 'copropriete_id': coproprieteId,
      if (lotId != null) 'lot_id': lotId,
      if (lotNumero != null) 'lot_numero': lotNumero,
      if (visiteurNom != null) 'visiteur_nom': visiteurNom,
      if (creeLe != null) 'cree_le': creeLe,
      if (tentatives != null) 'tentatives': tentatives,
      if (derniereErreur != null) 'derniere_erreur': derniereErreur,
      if (statut != null) 'statut': statut,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VisitesQueueCompanion copyWith({
    Value<String>? id,
    Value<String>? coproprieteId,
    Value<String>? lotId,
    Value<String?>? lotNumero,
    Value<String>? visiteurNom,
    Value<DateTime>? creeLe,
    Value<int>? tentatives,
    Value<String?>? derniereErreur,
    Value<String>? statut,
    Value<int>? rowid,
  }) {
    return VisitesQueueCompanion(
      id: id ?? this.id,
      coproprieteId: coproprieteId ?? this.coproprieteId,
      lotId: lotId ?? this.lotId,
      lotNumero: lotNumero ?? this.lotNumero,
      visiteurNom: visiteurNom ?? this.visiteurNom,
      creeLe: creeLe ?? this.creeLe,
      tentatives: tentatives ?? this.tentatives,
      derniereErreur: derniereErreur ?? this.derniereErreur,
      statut: statut ?? this.statut,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (coproprieteId.present) {
      map['copropriete_id'] = Variable<String>(coproprieteId.value);
    }
    if (lotId.present) {
      map['lot_id'] = Variable<String>(lotId.value);
    }
    if (lotNumero.present) {
      map['lot_numero'] = Variable<String>(lotNumero.value);
    }
    if (visiteurNom.present) {
      map['visiteur_nom'] = Variable<String>(visiteurNom.value);
    }
    if (creeLe.present) {
      map['cree_le'] = Variable<DateTime>(creeLe.value);
    }
    if (tentatives.present) {
      map['tentatives'] = Variable<int>(tentatives.value);
    }
    if (derniereErreur.present) {
      map['derniere_erreur'] = Variable<String>(derniereErreur.value);
    }
    if (statut.present) {
      map['statut'] = Variable<String>(statut.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('VisitesQueueCompanion(')
          ..write('id: $id, ')
          ..write('coproprieteId: $coproprieteId, ')
          ..write('lotId: $lotId, ')
          ..write('lotNumero: $lotNumero, ')
          ..write('visiteurNom: $visiteurNom, ')
          ..write('creeLe: $creeLe, ')
          ..write('tentatives: $tentatives, ')
          ..write('derniereErreur: $derniereErreur, ')
          ..write('statut: $statut, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CacheEntriesTable extends CacheEntries
    with TableInfo<$CacheEntriesTable, CacheEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CacheEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _cleMeta = const VerificationMeta('cle');
  @override
  late final GeneratedColumn<String> cle = GeneratedColumn<String>(
    'cle',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonMeta = const VerificationMeta('json');
  @override
  late final GeneratedColumn<String> json = GeneratedColumn<String>(
    'json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _misAJourLeMeta = const VerificationMeta(
    'misAJourLe',
  );
  @override
  late final GeneratedColumn<DateTime> misAJourLe = GeneratedColumn<DateTime>(
    'mis_a_jour_le',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [cle, json, misAJourLe];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_entries';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheEntry> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('cle')) {
      context.handle(
        _cleMeta,
        cle.isAcceptableOrUnknown(data['cle']!, _cleMeta),
      );
    } else if (isInserting) {
      context.missing(_cleMeta);
    }
    if (data.containsKey('json')) {
      context.handle(
        _jsonMeta,
        json.isAcceptableOrUnknown(data['json']!, _jsonMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonMeta);
    }
    if (data.containsKey('mis_a_jour_le')) {
      context.handle(
        _misAJourLeMeta,
        misAJourLe.isAcceptableOrUnknown(
          data['mis_a_jour_le']!,
          _misAJourLeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_misAJourLeMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {cle};
  @override
  CacheEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheEntry(
      cle:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}cle'],
          )!,
      json:
          attachedDatabase.typeMapping.read(
            DriftSqlType.string,
            data['${effectivePrefix}json'],
          )!,
      misAJourLe:
          attachedDatabase.typeMapping.read(
            DriftSqlType.dateTime,
            data['${effectivePrefix}mis_a_jour_le'],
          )!,
    );
  }

  @override
  $CacheEntriesTable createAlias(String alias) {
    return $CacheEntriesTable(attachedDatabase, alias);
  }
}

class CacheEntry extends DataClass implements Insertable<CacheEntry> {
  final String cle;
  final String json;
  final DateTime misAJourLe;
  const CacheEntry({
    required this.cle,
    required this.json,
    required this.misAJourLe,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['cle'] = Variable<String>(cle);
    map['json'] = Variable<String>(json);
    map['mis_a_jour_le'] = Variable<DateTime>(misAJourLe);
    return map;
  }

  CacheEntriesCompanion toCompanion(bool nullToAbsent) {
    return CacheEntriesCompanion(
      cle: Value(cle),
      json: Value(json),
      misAJourLe: Value(misAJourLe),
    );
  }

  factory CacheEntry.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheEntry(
      cle: serializer.fromJson<String>(json['cle']),
      json: serializer.fromJson<String>(json['json']),
      misAJourLe: serializer.fromJson<DateTime>(json['misAJourLe']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'cle': serializer.toJson<String>(cle),
      'json': serializer.toJson<String>(json),
      'misAJourLe': serializer.toJson<DateTime>(misAJourLe),
    };
  }

  CacheEntry copyWith({String? cle, String? json, DateTime? misAJourLe}) =>
      CacheEntry(
        cle: cle ?? this.cle,
        json: json ?? this.json,
        misAJourLe: misAJourLe ?? this.misAJourLe,
      );
  CacheEntry copyWithCompanion(CacheEntriesCompanion data) {
    return CacheEntry(
      cle: data.cle.present ? data.cle.value : this.cle,
      json: data.json.present ? data.json.value : this.json,
      misAJourLe:
          data.misAJourLe.present ? data.misAJourLe.value : this.misAJourLe,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheEntry(')
          ..write('cle: $cle, ')
          ..write('json: $json, ')
          ..write('misAJourLe: $misAJourLe')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(cle, json, misAJourLe);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheEntry &&
          other.cle == this.cle &&
          other.json == this.json &&
          other.misAJourLe == this.misAJourLe);
}

class CacheEntriesCompanion extends UpdateCompanion<CacheEntry> {
  final Value<String> cle;
  final Value<String> json;
  final Value<DateTime> misAJourLe;
  final Value<int> rowid;
  const CacheEntriesCompanion({
    this.cle = const Value.absent(),
    this.json = const Value.absent(),
    this.misAJourLe = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheEntriesCompanion.insert({
    required String cle,
    required String json,
    required DateTime misAJourLe,
    this.rowid = const Value.absent(),
  }) : cle = Value(cle),
       json = Value(json),
       misAJourLe = Value(misAJourLe);
  static Insertable<CacheEntry> custom({
    Expression<String>? cle,
    Expression<String>? json,
    Expression<DateTime>? misAJourLe,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (cle != null) 'cle': cle,
      if (json != null) 'json': json,
      if (misAJourLe != null) 'mis_a_jour_le': misAJourLe,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheEntriesCompanion copyWith({
    Value<String>? cle,
    Value<String>? json,
    Value<DateTime>? misAJourLe,
    Value<int>? rowid,
  }) {
    return CacheEntriesCompanion(
      cle: cle ?? this.cle,
      json: json ?? this.json,
      misAJourLe: misAJourLe ?? this.misAJourLe,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (cle.present) {
      map['cle'] = Variable<String>(cle.value);
    }
    if (json.present) {
      map['json'] = Variable<String>(json.value);
    }
    if (misAJourLe.present) {
      map['mis_a_jour_le'] = Variable<DateTime>(misAJourLe.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheEntriesCompanion(')
          ..write('cle: $cle, ')
          ..write('json: $json, ')
          ..write('misAJourLe: $misAJourLe, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$LocalDatabase extends GeneratedDatabase {
  _$LocalDatabase(QueryExecutor e) : super(e);
  $LocalDatabaseManager get managers => $LocalDatabaseManager(this);
  late final $VisitesQueueTable visitesQueue = $VisitesQueueTable(this);
  late final $CacheEntriesTable cacheEntries = $CacheEntriesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    visitesQueue,
    cacheEntries,
  ];
}

typedef $$VisitesQueueTableCreateCompanionBuilder =
    VisitesQueueCompanion Function({
      required String id,
      required String coproprieteId,
      required String lotId,
      Value<String?> lotNumero,
      required String visiteurNom,
      required DateTime creeLe,
      Value<int> tentatives,
      Value<String?> derniereErreur,
      Value<String> statut,
      Value<int> rowid,
    });
typedef $$VisitesQueueTableUpdateCompanionBuilder =
    VisitesQueueCompanion Function({
      Value<String> id,
      Value<String> coproprieteId,
      Value<String> lotId,
      Value<String?> lotNumero,
      Value<String> visiteurNom,
      Value<DateTime> creeLe,
      Value<int> tentatives,
      Value<String?> derniereErreur,
      Value<String> statut,
      Value<int> rowid,
    });

class $$VisitesQueueTableFilterComposer
    extends Composer<_$LocalDatabase, $VisitesQueueTable> {
  $$VisitesQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get coproprieteId => $composableBuilder(
    column: $table.coproprieteId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lotId => $composableBuilder(
    column: $table.lotId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lotNumero => $composableBuilder(
    column: $table.lotNumero,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get visiteurNom => $composableBuilder(
    column: $table.visiteurNom,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get creeLe => $composableBuilder(
    column: $table.creeLe,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get tentatives => $composableBuilder(
    column: $table.tentatives,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get derniereErreur => $composableBuilder(
    column: $table.derniereErreur,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get statut => $composableBuilder(
    column: $table.statut,
    builder: (column) => ColumnFilters(column),
  );
}

class $$VisitesQueueTableOrderingComposer
    extends Composer<_$LocalDatabase, $VisitesQueueTable> {
  $$VisitesQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get coproprieteId => $composableBuilder(
    column: $table.coproprieteId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lotId => $composableBuilder(
    column: $table.lotId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lotNumero => $composableBuilder(
    column: $table.lotNumero,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get visiteurNom => $composableBuilder(
    column: $table.visiteurNom,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get creeLe => $composableBuilder(
    column: $table.creeLe,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get tentatives => $composableBuilder(
    column: $table.tentatives,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get derniereErreur => $composableBuilder(
    column: $table.derniereErreur,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get statut => $composableBuilder(
    column: $table.statut,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$VisitesQueueTableAnnotationComposer
    extends Composer<_$LocalDatabase, $VisitesQueueTable> {
  $$VisitesQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get coproprieteId => $composableBuilder(
    column: $table.coproprieteId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lotId =>
      $composableBuilder(column: $table.lotId, builder: (column) => column);

  GeneratedColumn<String> get lotNumero =>
      $composableBuilder(column: $table.lotNumero, builder: (column) => column);

  GeneratedColumn<String> get visiteurNom => $composableBuilder(
    column: $table.visiteurNom,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get creeLe =>
      $composableBuilder(column: $table.creeLe, builder: (column) => column);

  GeneratedColumn<int> get tentatives => $composableBuilder(
    column: $table.tentatives,
    builder: (column) => column,
  );

  GeneratedColumn<String> get derniereErreur => $composableBuilder(
    column: $table.derniereErreur,
    builder: (column) => column,
  );

  GeneratedColumn<String> get statut =>
      $composableBuilder(column: $table.statut, builder: (column) => column);
}

class $$VisitesQueueTableTableManager
    extends
        RootTableManager<
          _$LocalDatabase,
          $VisitesQueueTable,
          VisitesQueueData,
          $$VisitesQueueTableFilterComposer,
          $$VisitesQueueTableOrderingComposer,
          $$VisitesQueueTableAnnotationComposer,
          $$VisitesQueueTableCreateCompanionBuilder,
          $$VisitesQueueTableUpdateCompanionBuilder,
          (
            VisitesQueueData,
            BaseReferences<
              _$LocalDatabase,
              $VisitesQueueTable,
              VisitesQueueData
            >,
          ),
          VisitesQueueData,
          PrefetchHooks Function()
        > {
  $$VisitesQueueTableTableManager(_$LocalDatabase db, $VisitesQueueTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer:
              () => $$VisitesQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer:
              () => $$VisitesQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer:
              () =>
                  $$VisitesQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> coproprieteId = const Value.absent(),
                Value<String> lotId = const Value.absent(),
                Value<String?> lotNumero = const Value.absent(),
                Value<String> visiteurNom = const Value.absent(),
                Value<DateTime> creeLe = const Value.absent(),
                Value<int> tentatives = const Value.absent(),
                Value<String?> derniereErreur = const Value.absent(),
                Value<String> statut = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VisitesQueueCompanion(
                id: id,
                coproprieteId: coproprieteId,
                lotId: lotId,
                lotNumero: lotNumero,
                visiteurNom: visiteurNom,
                creeLe: creeLe,
                tentatives: tentatives,
                derniereErreur: derniereErreur,
                statut: statut,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String coproprieteId,
                required String lotId,
                Value<String?> lotNumero = const Value.absent(),
                required String visiteurNom,
                required DateTime creeLe,
                Value<int> tentatives = const Value.absent(),
                Value<String?> derniereErreur = const Value.absent(),
                Value<String> statut = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VisitesQueueCompanion.insert(
                id: id,
                coproprieteId: coproprieteId,
                lotId: lotId,
                lotNumero: lotNumero,
                visiteurNom: visiteurNom,
                creeLe: creeLe,
                tentatives: tentatives,
                derniereErreur: derniereErreur,
                statut: statut,
                rowid: rowid,
              ),
          withReferenceMapper:
              (p0) =>
                  p0
                      .map(
                        (e) => (
                          e.readTable(table),
                          BaseReferences(db, table, e),
                        ),
                      )
                      .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$VisitesQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$LocalDatabase,
      $VisitesQueueTable,
      VisitesQueueData,
      $$VisitesQueueTableFilterComposer,
      $$VisitesQueueTableOrderingComposer,
      $$VisitesQueueTableAnnotationComposer,
      $$VisitesQueueTableCreateCompanionBuilder,
      $$VisitesQueueTableUpdateCompanionBuilder,
      (
        VisitesQueueData,
        BaseReferences<_$LocalDatabase, $VisitesQueueTable, VisitesQueueData>,
      ),
      VisitesQueueData,
      PrefetchHooks Function()
    >;
typedef $$CacheEntriesTableCreateCompanionBuilder =
    CacheEntriesCompanion Function({
      required String cle,
      required String json,
      required DateTime misAJourLe,
      Value<int> rowid,
    });
typedef $$CacheEntriesTableUpdateCompanionBuilder =
    CacheEntriesCompanion Function({
      Value<String> cle,
      Value<String> json,
      Value<DateTime> misAJourLe,
      Value<int> rowid,
    });

class $$CacheEntriesTableFilterComposer
    extends Composer<_$LocalDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get cle => $composableBuilder(
    column: $table.cle,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get misAJourLe => $composableBuilder(
    column: $table.misAJourLe,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CacheEntriesTableOrderingComposer
    extends Composer<_$LocalDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get cle => $composableBuilder(
    column: $table.cle,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get json => $composableBuilder(
    column: $table.json,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get misAJourLe => $composableBuilder(
    column: $table.misAJourLe,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CacheEntriesTableAnnotationComposer
    extends Composer<_$LocalDatabase, $CacheEntriesTable> {
  $$CacheEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get cle =>
      $composableBuilder(column: $table.cle, builder: (column) => column);

  GeneratedColumn<String> get json =>
      $composableBuilder(column: $table.json, builder: (column) => column);

  GeneratedColumn<DateTime> get misAJourLe => $composableBuilder(
    column: $table.misAJourLe,
    builder: (column) => column,
  );
}

class $$CacheEntriesTableTableManager
    extends
        RootTableManager<
          _$LocalDatabase,
          $CacheEntriesTable,
          CacheEntry,
          $$CacheEntriesTableFilterComposer,
          $$CacheEntriesTableOrderingComposer,
          $$CacheEntriesTableAnnotationComposer,
          $$CacheEntriesTableCreateCompanionBuilder,
          $$CacheEntriesTableUpdateCompanionBuilder,
          (
            CacheEntry,
            BaseReferences<_$LocalDatabase, $CacheEntriesTable, CacheEntry>,
          ),
          CacheEntry,
          PrefetchHooks Function()
        > {
  $$CacheEntriesTableTableManager(_$LocalDatabase db, $CacheEntriesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer:
              () => $$CacheEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer:
              () => $$CacheEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer:
              () =>
                  $$CacheEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> cle = const Value.absent(),
                Value<String> json = const Value.absent(),
                Value<DateTime> misAJourLe = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheEntriesCompanion(
                cle: cle,
                json: json,
                misAJourLe: misAJourLe,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String cle,
                required String json,
                required DateTime misAJourLe,
                Value<int> rowid = const Value.absent(),
              }) => CacheEntriesCompanion.insert(
                cle: cle,
                json: json,
                misAJourLe: misAJourLe,
                rowid: rowid,
              ),
          withReferenceMapper:
              (p0) =>
                  p0
                      .map(
                        (e) => (
                          e.readTable(table),
                          BaseReferences(db, table, e),
                        ),
                      )
                      .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CacheEntriesTableProcessedTableManager =
    ProcessedTableManager<
      _$LocalDatabase,
      $CacheEntriesTable,
      CacheEntry,
      $$CacheEntriesTableFilterComposer,
      $$CacheEntriesTableOrderingComposer,
      $$CacheEntriesTableAnnotationComposer,
      $$CacheEntriesTableCreateCompanionBuilder,
      $$CacheEntriesTableUpdateCompanionBuilder,
      (
        CacheEntry,
        BaseReferences<_$LocalDatabase, $CacheEntriesTable, CacheEntry>,
      ),
      CacheEntry,
      PrefetchHooks Function()
    >;

class $LocalDatabaseManager {
  final _$LocalDatabase _db;
  $LocalDatabaseManager(this._db);
  $$VisitesQueueTableTableManager get visitesQueue =>
      $$VisitesQueueTableTableManager(_db, _db.visitesQueue);
  $$CacheEntriesTableTableManager get cacheEntries =>
      $$CacheEntriesTableTableManager(_db, _db.cacheEntries);
}
