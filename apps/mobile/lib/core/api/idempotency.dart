import 'dart:convert';

import 'package:uuid/uuid.dart';

/// Clé d'idempotence STABLE d'une intention d'écriture (CLAUDE.md §1.3).
///
/// Un formulaire (ou une action) garde la même clé d'un essai à l'autre : « Réessayer » après un
/// délai dépassé rejoue la même requête, et le serveur renvoie la réponse déjà enregistrée au lieu
/// d'écrire un second paiement / vote / appel de fonds. La clé change seulement :
///  - après un succès ([consumed]) — l'intention suivante est une autre écriture ;
///  - si le contenu envoyé change ([forPayload]) — même clé + autre contenu = 409 côté serveur,
///    donc un montant corrigé est une nouvelle intention.
class IdemKey {
  IdemKey();

  static const _uuid = Uuid();
  String _key = _uuid.v4();
  String? _signature;

  /// Clé actuelle, sans tenir compte du contenu.
  String get value => _key;

  /// Clé pour ce contenu : identique tant que le contenu ne change pas.
  String forPayload(Object? body) {
    final sig = _sign(body);
    if (_signature != null && _signature != sig) _key = _uuid.v4();
    _signature = sig;
    return _key;
  }

  /// Écriture confirmée par le serveur : la prochaine tentative est une nouvelle intention.
  void consumed() {
    _key = _uuid.v4();
    _signature = null;
  }

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

  /// Succès : l'intention est oubliée (une nouvelle action aura une nouvelle clé).
  static void done(String intent) => _keys.remove(intent);
}
