import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syndicup/core/feel/feel.dart';
import 'package:syndicup/core/widgets/widgets.dart';

/// Contrat des primitives vivantes (docs/ALIVE_GUIDE.md §3).
Widget _app(Widget child, {bool reduce = false, TextDirection dir = TextDirection.ltr}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduce),
        child: Directionality(textDirection: dir, child: Scaffold(body: Center(child: child))),
      ),
    );

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    ClientFlags.instance.load(prefs);
    Sensations.instance.load(prefs);
  });

  group('compareFigures (aucun float)', () {
    test('montants formatés, séparateurs insécables, signe', () {
      expect(compareFigures('1 250,00 MAD', '999,99 MAD'), 1);
      expect(compareFigures('−5,00 MAD', '1,00 MAD'), -1);
      expect(compareFigures('12,5 %', '8 %'), 1);
      expect(compareFigures('7,10 MAD', '7,1 MAD'), 0);
      expect(compareFigures('—', '1 MAD'), isNull);
    });
  });

  group('AnimatedFigureText', () {
    testWidgets('premier affichage : texte simple, aucune animation', (t) async {
      await t.pumpWidget(_app(const AnimatedFigureText('1 250,00 MAD')));
      expect(find.text('1 250,00 MAD'), findsOneWidget);
      expect(t.hasRunningAnimations, isFalse);
    });

    testWidgets('changement de valeur : roulement puis texte final exact', (t) async {
      await t.pumpWidget(_app(const AnimatedFigureText('1 250,00 MAD')));
      await t.pumpWidget(_app(const AnimatedFigureText('1 300,00 MAD')));
      await t.pump(const Duration(milliseconds: 100));
      expect(t.hasRunningAnimations, isTrue);
      // Lecteurs d'écran : la valeur finale seulement, jamais les étapes.
      expect(find.bySemanticsLabel('1 300,00 MAD'), findsOneWidget);
      await t.pumpAndSettle();
      expect(find.text('1 300,00 MAD'), findsOneWidget);
    });

    testWidgets('alive_v1 coupé : aucun roulement', (t) async {
      ClientFlags.instance.debugSet('alive_v1', false);
      await t.pumpWidget(_app(const AnimatedFigureText('10 MAD')));
      await t.pumpWidget(_app(const AnimatedFigureText('20 MAD')));
      await t.pump(const Duration(milliseconds: 50));
      expect(find.text('20 MAD'), findsOneWidget);
      ClientFlags.instance.debugSet('alive_v1', true);
    });
  });

  group('SuButton', () {
    testWidgets('chargement → coche → libellé', (t) async {
      Widget b(bool loading) => _app(SuButton(label: 'Enregistrer', loading: loading, onPressed: () {}));
      await t.pumpWidget(b(true));
      expect(find.text('Enregistrer'), findsNothing);
      await t.pumpWidget(b(false));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Enregistrer'), findsNothing); // la coche occupe le bouton
      await t.pump(const Duration(milliseconds: 1000));
      await t.pumpAndSettle();
      expect(find.text('Enregistrer'), findsOneWidget);
    });

    testWidgets('nouvel échec : secousse', (t) async {
      Widget b(Object? fail) => _app(SuButton(label: 'Payer', fail: fail, onPressed: () {}));
      await t.pumpWidget(b(null));
      await t.pumpWidget(b(Object()));
      await t.pump(const Duration(milliseconds: 60));
      final tr = t.widget<Transform>(find.descendant(of: find.byType(SuShake), matching: find.byType(Transform)).first);
      expect(tr.transform.getTranslation().x, isNot(0));
      await t.pumpAndSettle();
    });
  });

  group('SuCheckbox', () {
    testWidgets('bascule + sémantique cochée', (t) async {
      bool v = false;
      await t.pumpWidget(_app(StatefulBuilder(builder: (c, set) => SuCheckbox(value: v, label: 'Étape', onChanged: (x) => set(() => v = x)))));
      await t.tap(find.text('Étape'));
      await t.pumpAndSettle();
      expect(v, isTrue);
    });
  });

  group('SuLiveColumn', () {
    testWidgets('premier rendu sans animation ; ligne insérée animée', (t) async {
      Widget col(List<int> ids) => _app(SuLiveColumn(children: [for (final i in ids) Text('ligne $i', key: ValueKey(i))]));
      await t.pumpWidget(col([1, 2]));
      expect(t.hasRunningAnimations, isFalse);
      await t.pumpWidget(col([3, 1, 2]));
      await t.pump(const Duration(milliseconds: 50));
      expect(t.hasRunningAnimations, isTrue);
      await t.pumpAndSettle();
      expect(find.text('ligne 3'), findsOneWidget);
      // Retrait : la ligne se replie puis disparaît.
      await t.pumpWidget(col([3, 2]));
      await t.pumpAndSettle();
      expect(find.text('ligne 1'), findsNothing);
    });
  });
}
