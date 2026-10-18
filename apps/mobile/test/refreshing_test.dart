import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/refresh.dart';

/// Lectures factices : la réponse arrive quand le test la libère.
Completer<int> _reponse = Completer<int>();

final _lecture = FutureProvider.autoDispose<int>((ref) => _reponse.future);

final _famille = FutureProvider.autoDispose.family<String, String>((ref, id) => Future<String>.value('lot $id'));

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

// Temps réel (runAsync) : l'attente porte sur de vraies réponses asynchrones, pas sur l'horloge
// simulée du banc de test.
void main() {
  setUp(() => _reponse = Completer<int>());

  testWidgets('refreshing attend la nouvelle réponse avant de rendre la main', (tester) async {
    final ref = await _monter(tester);
    await tester.runAsync(() async {
      var fini = false;
      final f = refreshing(ref, [_lecture]).then((_) => fini = true);
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(fini, isFalse, reason: 'pas de coche tant que le serveur n\'a pas répondu');
      _reponse.complete(42);
      await f.timeout(const Duration(seconds: 3));
      expect(fini, isTrue);
    });
  });

  testWidgets('instance de famille attendue ; famille entière seulement invalidée', (tester) async {
    final ref = await _monter(tester);
    await tester.runAsync(() async {
      await refreshing(ref, [_famille('A')]).timeout(const Duration(seconds: 3));
      await refreshing(ref, [_famille]).timeout(const Duration(seconds: 3));
    });
  });

  testWidgets('délai dépassé : on rend la main', (tester) async {
    final ref = await _monter(tester);
    await tester.runAsync(() async {
      await refreshing(ref, [_lecture], timeout: const Duration(milliseconds: 50)).timeout(const Duration(seconds: 3));
      _reponse.complete(1);
    });
  });
}
