import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/util/deferred_commit.dart';

/// Horloge manuelle : [avancer] déclenche les minuteurs échus.
class _Horloge {
  Duration maintenant = Duration.zero;
  final List<_FauxTimer> timers = [];

  Timer start(Duration delai, void Function() fn) {
    final t = _FauxTimer(maintenant + delai, fn);
    timers.add(t);
    return t;
  }

  void avancer(Duration d) {
    maintenant += d;
    for (final t in timers.toList()) {
      if (t.isActive && t.echeance <= maintenant) t.declencher();
    }
  }

  int get actifs => timers.where((t) => t.isActive).length;
}

class _FauxTimer implements Timer {
  _FauxTimer(this.echeance, this._fn);
  final Duration echeance;
  final void Function() _fn;
  bool _actif = true;

  void declencher() {
    _actif = false;
    _fn();
  }

  @override
  void cancel() => _actif = false;
  @override
  bool get isActive => _actif;
  @override
  int get tick => 0;
}

void main() {
  late _Horloge h;
  late List<List<String>> envois;
  late EnvoiDiffere<String> d;
  const six = Duration(seconds: 6);

  setUp(() {
    h = _Horloge();
    envois = [];
    d = EnvoiDiffere<String>(envois.add, delai: six, startTimer: h.start);
  });

  test('rien ne part avant 6 s ; le lot part une seule fois', () {
    d.programmer(['a']);
    h.avancer(const Duration(milliseconds: 5999));
    expect(envois, isEmpty);
    expect(d.enAttente('a'), isTrue);
    h.avancer(const Duration(milliseconds: 1));
    expect(envois, [
      ['a'],
    ]);
    h.avancer(const Duration(seconds: 10));
    expect(envois, hasLength(1));
    expect(d.enAttente('a'), isFalse);
  });

  test('Annuler avant expiration : aucune requête, clés rendues', () {
    final id = d.programmer(['a', 'b'])!;
    expect(d.annuler(id), ['a', 'b']);
    expect(h.actifs, 0);
    h.avancer(const Duration(seconds: 10));
    expect(envois, isEmpty);
  });

  test('Annuler après envoi : null', () {
    final id = d.programmer(['a'])!;
    h.avancer(six);
    expect(d.annuler(id), isNull);
  });

  test('vider (dispose / pause) envoie tout immédiatement, sans doublon ensuite', () {
    d.programmer(['a']);
    d.programmer(['b', 'c']);
    d.vider();
    expect(envois, [
      ['a'],
      ['b', 'c'],
    ]);
    expect(h.actifs, 0);
    h.avancer(const Duration(seconds: 10));
    expect(envois, hasLength(2));
    expect(d.nbLots, 0);
  });

  test('retirer (notification ouverte) : la clé ne repart pas ; lot vidé jamais envoyé', () {
    d.programmer(['a']);
    d.programmer(['b', 'c']);
    d.retirer('a');
    d.retirer('b');
    expect(d.cles, {'c'});
    h.avancer(six);
    expect(envois, [
      ['c'],
    ]);
  });

  test('dédoublonne ; lot vide = null', () {
    d.programmer(['a', 'a']);
    expect(d.programmer(['a']), isNull);
    expect(d.programmer(const []), isNull);
    expect(d.programmer(['a', 'b']), isNotNull);
    h.avancer(six);
    expect(envois, [
      ['a'],
      ['b'],
    ]);
  });
}
