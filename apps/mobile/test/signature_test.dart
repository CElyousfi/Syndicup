import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syndicup/core/feel/feel.dart';
import 'package:syndicup/core/i18n/i18n.dart';
import 'package:syndicup/core/widgets/widgets.dart';

/// Moments signature : ≤ 1,2 s, non bloquants (se retirent seuls), passables d'un tap,
/// muets quand alive_v1 est coupé.
Widget _app(void Function(BuildContext) onTap) => ProviderlessDict(
      child: MaterialApp(
        locale: const Locale('fr'),
        home: Builder(builder: (c) => Scaffold(body: Center(child: TextButton(onPressed: () => onTap(c), child: const Text('go'))))),
      ),
    );

/// Le dictionnaire est lu via `context.dict` (Localizations) : MaterialApp suffit en FR.
class ProviderlessDict extends StatelessWidget {
  const ProviderlessDict({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => child;
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    ClientFlags.instance.load(prefs);
    Sensations.instance.load(prefs);
  });

  testWidgets('annexes : calque joué puis retiré seul (≤ 1,2 s + sortie)', (t) async {
    await t.pumpWidget(_app((c) => SuSignature.annexes(c)));
    await t.tap(find.text('go'));
    await t.pump();
    for (int i = 0; i < 10; i++) {
      await t.pump(const Duration(milliseconds: 100));
    }
    expect(find.text(t.element(find.text('go')).dict.alive.conforme.toUpperCase()), findsOneWidget);
    await t.pump(const Duration(milliseconds: 1600));
    await t.pumpAndSettle();
    expect(find.text(t.element(find.text('go')).dict.alive.annexesGenerees), findsNothing);
  });

  testWidgets('passable d\'un tap', (t) async {
    await t.pumpWidget(_app((c) => SuSignature.vote(c)));
    await t.tap(find.text('go'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 200));
    expect(find.text(t.element(find.text('go')).dict.alive.voteEnregistre), findsOneWidget);
    await t.tapAt(const Offset(10, 10));
    await t.pumpAndSettle();
    expect(find.text(t.element(find.text('go')).dict.alive.voteEnregistre), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('alive_v1 coupé : aucun moment', (t) async {
    ClientFlags.instance.debugSet('alive_v1', false);
    await t.pumpWidget(_app((c) => SuSignature.annexes(c)));
    await t.tap(find.text('go'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 1000));
    expect(find.text(t.element(find.text('go')).dict.alive.annexesGenerees), findsNothing);
    ClientFlags.instance.debugSet('alive_v1', true);
  });

  testWidgets('écran de succès : le moment remplace l\'illustration', (t) async {
    await t.pumpWidget(_app((c) => showSuccess(c, title: 'Paiement enregistré', moment: SuMomentKind.payment, amount: '1250.00')));
    await t.tap(find.text('go'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 500));
    // Le montant enregistré est affiché, formaté comme partout.
    expect(find.textContaining('250,00'), findsOneWidget);
    expect(find.byType(SuMomentView), findsOneWidget);
    await t.pump(const Duration(seconds: 2));
    await t.pumpAndSettle();
    expect(find.text('PAIEMENT ENREGISTRÉ'), findsOneWidget);
  });
}
