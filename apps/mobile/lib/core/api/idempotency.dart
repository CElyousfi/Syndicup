import 'dart:convert';

import 'package:uuid/uuid.dart';

import 'api_result.dart';

/// Clé d'idempotence STABLE d'une intention d'écriture (CLAUDE.md §1.3).
///
/// Un formulaire (ou une action) garde la même clé d'un essai à l'autre : « Réessayer » après un
/// délai dépassé rejoue la même requête, et le serveur renvoie la réponse déjà enregistrée au lieu
/// d'écrire un second paiement / vote / appel de fonds.
///
/// Renouvellement :
///  - après un **succès** ([settle] avec un ApiOk, ou [consumed]) — l'intention suivante est une
///    autre écriture ;
///  - après un **refus certain** (4xx hors 409) puis un contenu modifié — le serveur n'a rien écrit,
///    un montant corrigé est une nouvelle intention ;
///  - **jamais** après un échec AMBIGU (réseau, délai, 5xx, 409) : l'écriture a peut-être eu lieu.
///    Même si le contenu change, la clé reste : le serveur répond 409 (« même clé, autre contenu »),
///    affiché « Actualiser » — mieux qu'un second paiement.
class IdemKey {
  IdemKey();

  static const _uuid = Uuid();
  String _key = _uuid.v4();
  String? _signature;
  bool _ambigu = false;

  /// Clé actuelle, sans tenir compte du contenu.
  String get value => _key;

  /// Dernière tentative au résultat incertain (réseau, délai, 5xx, 409).
  bool get ambiguous => _ambigu;

  /// Clé pour ce contenu : identique tant que le contenu ne change pas, ou tant que la dernière
  /// tentative est ambiguë.
  String forPayload(Object? body) {
    final sig = _sign(body);
    if (_signature != null && _signature != sig && !_ambigu) _key = _uuid.v4();
    _signature = sig;
    return _key;
  }

  /// Enregistre l'issue d'une tentative envoyée avec cette clé.
  void settle(ApiResult<Object?> r) {
    switch (r) {
      case ApiOk<Object?>():
        consumed();
      case ApiFail<Object?>(:final status, :final error):
        _ambigu = isAmbiguous(status, error.code);
    }
  }

  /// Écriture confirmée par le serveur : la prochaine tentative est une nouvelle intention.
  void consumed() {
    _key = _uuid.v4();
    _signature = null;
    _ambigu = false;
  }

  /// Échec dont on ne sait pas s'il a écrit : réseau, délai, réponse illisible, 5xx, conflit.
  static bool isAmbiguous(int status, String code) =>
      status == 0 || status >= 500 || status == 409 || code == 'NETWORK' || code == 'TIMEOUT' || code == 'PARSE_ERROR' || code == 'BAD_RESPONSE';

  static String _sign(Object? body) {
    try {
      return jsonEncode(body);
    } catch (_) {
      return body.toString();
    }
  }
}

/// Clés d'intention pour les actions sans état propre (bouton dans une liste, écran sans State) :
/// `IdemKeys.of('budget-activer:$id')`. Même intention → même clé jusqu'au succès.
class IdemKeys {
  IdemKeys._();
  static final Map<String, IdemKey> _keys = {};

  static IdemKey of(String intent) => _keys.putIfAbsent(intent, IdemKey.new);

  /// Issue d'une tentative : succès → l'intention est oubliée ; échec → ambiguïté mémorisée.
  static void settle(String intent, ApiResult<Object?> r) {
    if (r is ApiOk<Object?>) {
      done(intent);
    } else {
      _keys[intent]?.settle(r);
    }
  }

  /// Succès : l'intention est oubliée (une nouvelle action aura une nouvelle clé).
  static void done(String intent) => _keys.remove(intent);

  /// Déconnexion : aucune clé d'un utilisateur ne survit à sa session.
  static void clear() => _keys.clear();
}
