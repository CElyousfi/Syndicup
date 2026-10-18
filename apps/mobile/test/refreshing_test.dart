import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/refresh.dart';

/// Lectures factices : chaque construction attend que le test libère la réponse.
var _appels = 0;
var _appelsFamille = 0;
Completer<int> _reponse = Completer<int>();

final _lecture = FutureProvider.autoDispose<int>((ref) {
  _appels++;
  return _reponse.future;
});

final _famille = FutureProvider.autoDispose.family<String, String>((ref, id) async {
  _appelsFamille++;
  return 'lot $id';
});

Future<WidgetRef> _monter(WidgetTester tester) async {
  late WidgetRef capture;
  await tester.pumpWidget(ProviderScope(
    child: Consumer(builder: (context, ref, _) {
      capture = ref;
      return const SizedBox.shrink();
    }),
  ));
  return capture;
}

void main() {
  setUp(() {
    _appels = 0;
    _appelsFamille = 0;
    _reponse = Completer<int>();
  });

  testWidgets('refreshing attend la nouvelle réponse avant de rendre la main', (tester) async {
    final ref = await _monter(tester);
    var fini = false;
    unawaited(refreshing(ref, [_lecture]).then((_) => fini = true));
    await tester.pump();
    expect(_appels, 1, reason: 'la lecture a été relancée');
    expect(fini, isFalse, reason: 'pas de coche tant que le serveur n\'a pas répondu');
    _reponse.complete(42);
    await tester.pump();
    await tester.pump();
    expect(fini, isTrue);
  });

  testWidgets('une erreur termine aussi l\'actualisation (jamais bloquée)', (tester) async {
    final ref = await _monter(tester);
    var fini = false;
    unawaited(refreshing(ref, [_lecture]).then((_) => fini = true));
    await tester.pump();
    _reponse.completeError(StateError('réseau'));
    await tester.pump();
    await tester.pump();
    expect(fini, isTrue);
  });

  testWidgets('instance de famille attendue ; famille entière seulement invalidée', (tester) async {
    final ref = await _monter(tester);
    await refreshing(ref, [_famille('A')]);
    expect(_appelsFamille, 1);
    // Famille entière : rien à attendre (aucune instance écoutée), retour immédiat.
    await refreshing(ref, [_famille]);
  });

  testWidgets('délai dépassé : on rend la main', (tester) async {
    final ref = await _monter(tester);
    var fini = false;
    unawaited(refreshing(ref, [_lecture], timeout: const Duration(milliseconds: 50)).then((_) => fini = true));
    await tester.pump(const Duration(milliseconds: 60));
    await tester.pump();
    expect(fini, isTrue);
    _reponse.complete(1);
  });
}
