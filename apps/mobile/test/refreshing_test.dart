import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/refresh.dart';

/// Lectures factices : la réponse arrive quand le test la libère.
var _appels = 0;
Completer<int> _reponse = Completer<int>();

final _lecture = FutureProvider.autoDispose<int>((ref) {
  _appels++;
  return _reponse.future;
});

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

/// Le ProviderScope planifie son travail sur les images : on fait avancer les images.
Future<void> _jusqua(WidgetTester tester, bool Function() cond) async {
  for (var i = 0; i < 20 && !cond(); i++) {
    await tester.pump(const Duration(milliseconds: 10));
  }
}

void main() {
  setUp(() {
    _appels = 0;
    _reponse = Completer<int>();
  });

  testWidgets('refreshing attend la nouvelle réponse avant de rendre la main', (tester) async {
    final ref = await _monter(tester);
    var fini = false;
    unawaited(refreshing(ref, [_lecture]).then((_) => fini = true));
    await tester.pump(const Duration(milliseconds: 10));
    expect(_appels, greaterThanOrEqualTo(1), reason: 'la lecture a été relancée');
    expect(fini, isFalse, reason: 'pas de coche tant que le serveur n\'a pas répondu');
    _reponse.complete(42);
    await _jusqua(tester, () => fini);
    expect(fini, isTrue);
  });

  testWidgets('instance de famille attendue ; famille entière seulement invalidée', (tester) async {
    final ref = await _monter(tester);
    var a = false;
    var b = false;
    unawaited(refreshing(ref, [_famille('A')]).then((_) => a = true));
    unawaited(refreshing(ref, [_famille]).then((_) => b = true));
    await _jusqua(tester, () => a && b);
    expect(a, isTrue);
    expect(b, isTrue);
  });

  testWidgets('délai dépassé : on rend la main', (tester) async {
    final ref = await _monter(tester);
    var fini = false;
    unawaited(refreshing(ref, [_lecture], timeout: const Duration(milliseconds: 50)).then((_) => fini = true));
    await _jusqua(tester, () => fini);
    expect(fini, isTrue);
    _reponse.complete(1);
    await tester.pump();
  });
}
