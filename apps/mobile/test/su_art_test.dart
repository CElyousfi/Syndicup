import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/widgets/illustration.dart';
import 'package:syndicup/core/widgets/su_art.dart';

/// Set d'illustrations de marque (su_art.dart) : chemins, replis, noms historiques.
Widget _app(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  tearDown(() => SuIllustration.debugSetAssets(const {}));

  test('chemins conformes au nommage su_<ID>_<slug>_<S|C>.webp', () {
    expect(SuArt.e01.path(), 'assets/illustrations/su/su_E01_no-residences_C.webp');
    expect(SuArt.a01.path(cutout: false), 'assets/illustrations/su/su_A01_welcome_S.webp');
    // Identifiants uniques : un doublon casserait la correspondance avec le web.
    expect(SuArt.values.map((a) => a.id).toSet().length, SuArt.values.length);
    expect(SuArt.values.map((a) => a.slug).toSet().length, SuArt.values.length);
  });

  test('chaque emplacement de l\'ancien set a sa planche dans le nouveau', () {
    // Les noms que les écrans demandent encore (assets/illustrations/README.md) : aucun ne doit
    // rester sans correspondance, sinon l'app mélange deux styles.
    const anciens = [
      'welcome-hero', 'offline', 'ob-1-residence', 'ob-2-charges', 'ob-3-incident', 'ob-4-ag',
      'empty-incidents', 'empty-appels', 'empty-documents', 'empty-reservations', 'empty-visites', 'empty-notifications',
      'empty-ag', 'empty-annonces', 'empty-lots', 'empty-taches', 'empty-parkings', 'empty-lcd', 'empty-personnel',
      'empty-litiges', 'empty-search',
      'ok-paiement', 'ok-incident', 'ok-vote', 'ok-reservation', 'ok-invitation', 'ok-visiteur', 'ok-general',
      'poster-ag', 'poster-onboarding', 'poster-transparence', 'poster-annonce', 'poster-securite',
      'quick-paiement', 'quick-appel', 'quick-invitation', 'quick-incident', 'quick-sejour', 'quick-reservation',
      'quick-ag', 'quick-visiteur', 'quick-copropriete', 'quick-payer',
    ];
    for (final n in anciens) {
      expect(SuArt.legacy[n], isNotNull, reason: n);
    }
    expect(SuArt.p01.path(), 'assets/illustrations/su/su_P01_poster-ag_P.webp');
    expect(SuArt.w01.defaultCutout, isFalse);
    expect(SuArt.e01.defaultCutout, isTrue);
  });

  testWidgets('planche livrée : plus jamais l\'animation Lottie de l\'ancien style', (t) async {
    SuIllustration.debugSetAssets({SuArt.d01.path(), SuIllustration.animPath('offline'), SuIllustration.legacyPath('offline')});
    expect(SuIllustration.hasAnim('offline'), isFalse);
    expect(SuIllustration.path('offline'), SuArt.d01.path());
  });

  testWidgets('planche absente : le repli, jamais un trou', (t) async {
    SuIllustration.debugSetAssets(const {});
    expect(SuArt.available, isEmpty);
    await t.pumpWidget(_app(const SuArtImage(SuArt.d01, fallback: Text('repli'))));
    expect(find.text('repli'), findsOneWidget);
  });

  testWidgets('découpe absente mais scène livrée : la scène', (t) async {
    SuIllustration.debugSetAssets({SuArt.d01.path(cutout: false)});
    await t.pumpWidget(_app(const SuArtImage(SuArt.d01, fallback: Text('repli'))));
    final img = t.widget<Image>(find.byType(Image));
    expect((img.image as AssetImage).assetName, SuArt.d01.path(cutout: false));
  });

  testWidgets("nom historique 'offline' → planche D01 quand livrée", (t) async {
    SuIllustration.debugSetAssets({SuArt.d01.path()});
    expect(SuIllustration.has('offline'), isTrue);
    await t.pumpWidget(_app(const SuIllustration('offline', size: 100, fallback: Text('repli'))));
    final img = t.widget<Image>(find.byType(Image));
    expect((img.image as AssetImage).assetName, SuArt.d01.path());
  });

  testWidgets('nom historique sans planche ni PNG : repli', (t) async {
    SuIllustration.debugSetAssets(const {});
    await t.pumpWidget(_app(const SuIllustration('offline', size: 100, fallback: Text('repli'))));
    expect(find.text('repli'), findsOneWidget);
  });
}
