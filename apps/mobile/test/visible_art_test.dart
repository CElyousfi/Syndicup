import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syndicup/core/feel/feel.dart';
import 'package:syndicup/core/i18n/i18n.dart';
import 'package:syndicup/core/widgets/widgets.dart';
import 'package:syndicup/features/auth/welcome_screen.dart';
import 'package:syndicup/features/onboarding/onboarding_screen.dart';

/// Illustrations ENTIÈRES : jamais rognées par leur cadre, jamais recouvertes, jamais hors écran,
/// du petit téléphone (320×568) au grand (430×932), en FR comme en AR.
void main() {
  late SharedPreferences prefs;

  // Vraies polices de l'app (sinon Ahem : texte bien plus large que sur l'appareil).
  setUpAll(() async {
    final manifest = json.decode(await rootBundle.loadString('FontManifest.json')) as List;
    for (final f in manifest.cast<Map<String, dynamic>>()) {
      final loader = FontLoader(f['family'] as String);
      for (final a in (f['fonts'] as List).cast<Map<String, dynamic>>()) {
        loader.addFont(rootBundle.load(a['asset'] as String));
      }
      await loader.load();
    }
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    ClientFlags.instance.load(prefs);
    Sensations.instance.load(prefs);
  });

  tearDown(() => SuIllustration.debugSetAssets(const {}));

  Future<void> sized(WidgetTester t, Size s) async {
    t.view.physicalSize = s;
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
  }

  for (final rtl in [false, true]) {
    for (final band in [const Size(288, 160), const Size(340, 190), const Size(398, 120)]) {
      testWidgets('affiche ${band.width.toInt()}×${band.height.toInt()}${rtl ? ' RTL' : ''} : visuel entier dans la bande', (t) async {
        SuIllustration.debugSetAssets({SuIllustration.path('poster-ag')});
        await t.pumpWidget(MaterialApp(
          home: Directionality(
            textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
            child: Center(child: SizedBox(width: band.width, height: band.height, child: const PosterArt('poster-ag'))),
          ),
        ));
        final art = t.getRect(find.byType(SuLottieArt));
        final s = art.width / 1600;
        expect(art.height / 1000, closeTo(s, 1e-6), reason: 'ratio conservé');
        // Zone du visuel (poster-ag : 885..1526 × 193..891) dans la bande, quel que soit le ratio.
        final box = t.getRect(find.byType(PosterArt));
        final visual = Rect.fromLTRB(art.left + 885 * s, art.top + 193 * s, art.left + 1526 * s, art.top + 891 * s);
        expect(box.contains(visual.topLeft) && box.contains(visual.bottomRight - const Offset(0.01, 0.01)), isTrue, reason: '$visual hors de $box');
      });
    }
  }

  Widget app(Widget home, String lang) => ProviderScope(
        overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
        child: MaterialApp(locale: Locale(lang), supportedLocales: const [Locale('fr'), Locale('ar')], localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate], home: home),
      );

  void expectWhole(WidgetTester t, Finder art, Finder title) {
    final r = t.getRect(art);
    final screen = Offset.zero & t.view.physicalSize;
    expect(screen.contains(r.topLeft) && screen.contains(r.bottomRight - const Offset(0.01, 0.01)), isTrue, reason: 'illustration $r hors écran $screen');
    // Toujours une vraie place, même sur le plus petit écran.
    expect(r.width, greaterThanOrEqualTo(120));
    // Rien posé sur l'illustration : le titre commence sous elle.
    expect(t.getRect(title).top, greaterThanOrEqualTo(r.bottom));
  }

  for (final size in [const Size(320, 568), const Size(393, 852), const Size(430, 932)]) {
    for (final lang in ['fr', 'ar']) {
      testWidgets('accueil ${size.width.toInt()}×${size.height.toInt()} $lang : vidéo entière, seule', (t) async {
        await sized(t, size);
        SuIllustration.debugSetAssets({SuVideoArt.posterPath('welcome-hero')});
        await t.pumpWidget(app(const WelcomeScreen(), lang));
        await t.pump(const Duration(seconds: 2));
        _noError(t);
        final title = find.byWidgetPredicate((w) => w is Text && (w.style?.fontFamily ?? '').isNotEmpty && w.textAlign == TextAlign.center).first;
        expectWhole(t, find.byType(SuVideoArt), title);
      });

      testWidgets('onboarding ${size.width.toInt()}×${size.height.toInt()} $lang : vidéo entière, seule', (t) async {
        await sized(t, size);
        SuIllustration.debugSetAssets({for (final n in ['ob-1-residence', 'ob-2-charges', 'ob-3-incident', 'ob-4-ag']) SuVideoArt.posterPath(n)});
        await t.pumpWidget(app(const OnboardingScreen(), lang));
        await t.pump(const Duration(seconds: 2));
        _noError(t);
        final title = find.byWidgetPredicate((w) => w is Text && w.textAlign == TextAlign.center).first;
        expectWhole(t, find.byType(SuVideoArt).first, title);
      });
    }
  }
}

/// Aucune erreur de rendu (débordement…) ; sinon, le détail complet (widget fautif) en message.
void _noError(WidgetTester t) {
  final e = t.takeException();
  expect(e, isNull, reason: e is FlutterError ? e.toStringDeep() : '$e');
}
