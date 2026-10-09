import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syndicup/core/feel/feel.dart';
import 'package:syndicup/core/widgets/illustration.dart';

/// Illustrations vivantes (docs/ALIVE_ILLUSTRATIONS.md) : les chemins sans animation.
Widget _app(Widget child, {bool reduce = false}) => MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduce),
        child: Scaffold(body: Center(child: child)),
      ),
    );

const _png = 'assets/illustrations/ok-general.png';
const _json = 'assets/illustrations/ok-general.json';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    ClientFlags.instance.load(prefs);
    Sensations.instance.load(prefs);
  });

  tearDown(() => SuIllustration.debugSetAssets(const {}));

  testWidgets('illustration absente : le repli, jamais un trou', (t) async {
    SuIllustration.debugSetAssets(const {});
    await t.pumpWidget(_app(const SuIllustration('ok-general', size: 120, fallback: Text('repli'))));
    expect(find.text('repli'), findsOneWidget);
  });

  testWidgets('sans fichier .json : image de repos', (t) async {
    SuIllustration.debugSetAssets(const {_png});
    await t.pumpWidget(_app(const SuIllustration('ok-general', size: 120, fallback: Text('repli'))));
    expect(find.byType(Image), findsOneWidget);
  });

  testWidgets('animations réduites : image de repos, aucune animation', (t) async {
    SuIllustration.debugSetAssets(const {_png, _json});
    await t.pumpWidget(_app(const SuIllustration('ok-general', size: 120, fallback: Text('repli')), reduce: true));
    expect(find.byType(Image), findsOneWidget);
    expect(t.hasRunningAnimations, isFalse);
  });

  testWidgets('affiche : image de repos quand le mouvement est coupé', (t) async {
    SuIllustration.debugSetAssets(const {'assets/illustrations/poster-ag.png', 'assets/illustrations/poster-ag.json'});
    await t.pumpWidget(_app(const SizedBox(width: 300, child: SuLottieArtProbe()), reduce: true));
    expect(find.byType(Image), findsOneWidget);
  });
}

/// Affiche minimale (PosterArt vit dans cards.dart avec ses dépendances de thème).
class SuLottieArtProbe extends StatelessWidget {
  const SuLottieArtProbe({super.key});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 120,
        child: SuLottieArt('poster-ag', fit: BoxFit.cover, alignment: Alignment.centerRight, staticChild: Image.asset(SuIllustration.path('poster-ag'), fit: BoxFit.cover)),
      );
}
