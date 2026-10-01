import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/format/format.dart';
import 'package:syndicup/core/widgets/motion.dart';

/// L'odomètre n'anime que les CARACTÈRES de la chaîne formatée : à la fin de l'animation,
/// chaque chiffre affiché est exactement celui du montant (règle « argent hors float »).
void main() {
  Future<void> pump(WidgetTester tester, String text, {TextDirection dir = TextDirection.ltr}) async {
    await tester.pumpWidget(MaterialApp(
      home: Directionality(textDirection: dir, child: Scaffold(body: Center(child: AnimatedDigits(text, style: const TextStyle(fontSize: 20))))),
    ));
    await tester.pumpAndSettle();
  }

  testWidgets('expose le texte exact aux lecteurs d’écran', (tester) async {
    final montant = formatMAD('1250.5', const Locale('fr'));
    await pump(tester, montant);
    expect(find.bySemanticsLabel(montant), findsOneWidget);
  });

  testWidgets('chaque bande de chiffres s’arrête sur le bon chiffre', (tester) async {
    await pump(tester, formatMAD('98765.43', const Locale('ar')), dir: TextDirection.rtl);
    final translations = tester.widgetList<FractionalTranslation>(find.byType(FractionalTranslation)).map((f) => -f.translation.dy * 10).toList();
    // 9 8 7 6 5 4 3 — dans l'ordre de lecture du nombre.
    expect(translations.map((v) => v.round()).toList(), [9, 8, 7, 6, 5, 4, 3]);
    for (final v in translations) {
      expect((v - v.round()).abs() < 1e-9, isTrue);
    }
  });

  testWidgets('une valeur sans chiffre est rendue telle quelle', (tester) async {
    await pump(tester, '—');
    expect(find.text('—'), findsOneWidget);
    expect(find.byType(FractionalTranslation), findsNothing);
  });

  testWidgets('animations désactivées : état final immédiat', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(body: AnimatedDigits('42', style: const TextStyle(fontSize: 20))),
      ),
    ));
    await tester.pump();
    final v = tester.widgetList<FractionalTranslation>(find.byType(FractionalTranslation)).map((f) => (-f.translation.dy * 10).round()).toList();
    expect(v, [4, 2]);
  });
}
