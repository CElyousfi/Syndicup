import 'dart:async';

/// Démarre un minuteur ; injectable pour les tests (horloge factice).
typedef StartTimer = Timer Function(Duration delai, void Function() fn);

Timer _timerReel(Duration delai, void Function() fn) => Timer(delai, fn);

/// Envoi différé avec « Annuler » — action réversible côté CLIENT uniquement.
///
/// Cas d'usage : « marquer comme lu ». La ligne `notification` est append-only (preuve d'envoi,
/// Master Spec 7.2) : il n'existe aucun « non lu » serveur. La requête ne part qu'à l'expiration
/// du toast (ou quand l'écran est quitté / l'app passe en arrière-plan) ; « Annuler » retire le
/// lot avant tout envoi — rien n'a été fait, rien à défaire. Pur (aucun widget).
class EnvoiDiffere<K> {
  EnvoiDiffere(this._envoyer, {this.delai = const Duration(seconds: 6), StartTimer? startTimer}) : _start = startTimer ?? _timerReel;

  final void Function(List<K> cles) _envoyer;
  final Duration delai;
  final StartTimer _start;
  int _seq = 0;
  final Map<int, _Lot<K>> _lots = {};

  /// Programme un lot ; renvoie son identifiant (pour [annuler]), ou null si rien de neuf.
  int? programmer(Iterable<K> cles) {
    final uniques = <K>[];
    for (final k in cles) {
      if (!uniques.contains(k) && !enAttente(k)) uniques.add(k);
    }
    if (uniques.isEmpty) return null;
    final id = ++_seq;
    _lots[id] = _Lot(uniques, _start(delai, () => _envoyerLot(id)));
    return id;
  }

  /// « Annuler » : retire le lot s'il n'est pas encore parti ; renvoie ses clés (null si envoyé).
  List<K>? annuler(int id) {
    final lot = _lots.remove(id);
    if (lot == null) return null;
    lot.timer.cancel();
    return lot.cles;
  }

  /// Retire une clé de tout lot en attente (notification ouverte : lue tout de suite ailleurs).
  void retirer(K cle) {
    for (final id in _lots.keys.toList()) {
      final lot = _lots[id]!;
      if (!lot.cles.remove(cle)) continue;
      if (lot.cles.isEmpty) {
        lot.timer.cancel();
        _lots.remove(id);
      }
    }
  }

  /// Envoie TOUT ce qui attend, maintenant (dispose, pause de l'app).
  void vider() {
    for (final id in _lots.keys.toList()) {
      _envoyerLot(id);
    }
  }

  bool enAttente(K cle) => _lots.values.any((l) => l.cles.contains(cle));

  /// Clés en attente (pour l'affichage optimiste).
  Set<K> get cles => {for (final l in _lots.values) ...l.cles};

  int get nbLots => _lots.length;

  void _envoyerLot(int id) {
    final lot = _lots.remove(id);
    if (lot == null) return;
    lot.timer.cancel();
    _envoyer(List<K>.unmodifiable(lot.cles));
  }
}

class _Lot<K> {
  _Lot(this.cles, this.timer);
  final List<K> cles;
  final Timer timer;
}
