import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/feel/feel.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';
import '../auth/welcome_screen.dart';

/// Clé de préférence : l'onboarding de premier lancement a été vu (terminé ou passé).
const onboardingSeenKey = 'onboarding_vu';

/// Onboarding de premier lancement — d'après l'écran d'onboarding de la carte Wise
/// (refero.design, app iOS Wise) : barre de progression en tête, visuel héro (globe + carte
/// flottante → sphère photo de la résidence + carte d'interface flottante), titre-affiche en
/// capitales centré, pill d'action pleine en bas. Quatre étapes glissables, « Passer » toujours
/// disponible, langue modifiable dès le premier écran.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pages = PageController();
  int _index = 0;
  static const _count = 4;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _finish(String to) async {
    await ref.read(sharedPrefsProvider).setBool(onboardingSeenKey, true);
    if (!mounted) return;
    context.go(to);
  }

  void _next() {
    Haptics.select();
    if (_index == _count - 1) {
      _finish('/');
      return;
    }
    _pages.nextPage(duration: SuMotion.of(context, const Duration(milliseconds: 520)), curve: SuMotion.easeOut);
  }

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final slides = [
      (md.ob1Title, md.ob1Body, 'assets/images/residence-hero.jpg', 'ob-1-residence'),
      (md.ob2Title, md.ob2Body, 'assets/images/residence-entrance.jpg', 'ob-2-charges'),
      (md.ob3Title, md.ob3Body, 'assets/images/residence-courtyard.jpg', 'ob-3-incident'),
      (md.ob4Title, md.ob4Body, 'assets/images/espace-salle.jpg', 'ob-4-ag'),
    ];
    final last = _index == _count - 1;
    return Scaffold(
      backgroundColor: SuColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            // Barre de progression Wise + langue + « Passer ».
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 14, 12, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      label: fill(md.obStep, {'n': _index + 1, 'total': _count}),
                      child: Gauge((_index + 1) / _count, height: 6, color: SuColors.ink),
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedOpacity(
                    opacity: last ? 0 : 1,
                    duration: SuMotion.of(context, SuMotion.base),
                    child: IgnorePointer(ignoring: last, child: LinkButton(md.obSkip, onTap: () => _finish('/'))),
                  ),
                ],
              ),
            ),
            const Padding(padding: EdgeInsetsDirectional.fromSTEB(24, 4, 24, 0), child: Align(alignment: AlignmentDirectional.centerStart, child: LocaleSwitch())),
            Expanded(
              child: PageView.builder(
                controller: _pages,
                itemCount: _count,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => AnimatedBuilder(
                  animation: _pages,
                  builder: (context, _) {
                    // Décalage de page continu (−1…1) pour la parallaxe du visuel.
                    final page = _pages.hasClients && _pages.position.haveDimensions ? (_pages.page ?? 0) : 0.0;
                    final delta = (i - page).clamp(-1.0, 1.0);
                    return _Slide(title: slides[i].$1, body: slides[i].$2, photo: slides[i].$3, art: slides[i].$4, delta: delta, active: i == _index);
                  },
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SuButton(
                    onPressed: _next,
                    size: SuButtonSize.lg,
                    expand: true,
                    haptic: false,
                    child: SuFadeSwitch(
                      value: last,
                      slide: false,
                      alignment: AlignmentDirectional.center,
                      child: Text(last ? md.obStart : md.obNext),
                    ),
                  ),
                  SizedBox(
                    height: 52,
                    child: AnimatedOpacity(
                      opacity: last ? 1 : 0,
                      duration: SuMotion.of(context, SuMotion.slow),
                      child: IgnorePointer(ignoring: !last, child: Center(child: LinkButton(md.obAlready, onTap: () => _finish('/connexion')))),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({required this.title, required this.body, required this.photo, required this.art, required this.delta, required this.active});
  final String title;
  /// Illustration éditoriale animée (vidéo), seule et aussi grande que l'espace le permet.
  final String art;
  final String body;
  final String photo;
  final double delta;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final reduced = SuMotion.reduced(context);
    final dir = SuMotion.sign(context);
    return LayoutBuilder(builder: (context, c) {
      return Column(
        children: [
          Expanded(
            child: LayoutBuilder(builder: (context, box) {
              // Carré entier dans l'espace (marges comprises) : jamais rogné ni recouvert.
              final size = (box.maxWidth - 48 < box.maxHeight - 24 ? box.maxWidth - 48 : box.maxHeight - 24).clamp(0.0, 440.0);
              return Center(
                // Le visuel glisse moins vite que la page et tourne légèrement (parallaxe).
                child: Transform.translate(
                  offset: Offset(reduced ? 0 : delta * 70 * dir, 0),
                  child: Transform.rotate(
                    angle: reduced ? 0 : delta * 0.06,
                    // Vidéo ; repli : l'illustration Lottie, puis la photo.
                    child: SuVideoArt(art, size: size, radius: 32, active: active, fallback: SuIllustration(art, size: size, fallback: PhotoSphere(asset: photo, size: size * 0.87))),
                  ),
                ),
              );
            }),
          ),
          // Le texte ne prend jamais plus de 55 % de la page : le visuel garde sa place, et sur
          // un très petit écran c'est le texte qui défile.
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: c.maxHeight * 0.55),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  Text(SuType.posterText(context, title), textAlign: TextAlign.center, style: SuType.poster(context, (c.maxWidth * 0.105).clamp(30.0, 46.0))),
                  const SizedBox(height: 14),
                  Text(body, textAlign: TextAlign.center, style: t.bodyLarge?.copyWith(color: SuColors.soft, height: 1.5)),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      );
    });
  }
}

/// Sphère photo (le globe 3D de Wise, avec les vraies photos de la résidence) : découpe ronde,
/// ombrage radial pour le volume, reflet doux en haut.
class PhotoSphere extends StatelessWidget {
  const PhotoSphere({super.key, required this.asset, required this.size});
  final String asset;
  final double size;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: ClipOval(
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(asset, fit: BoxFit.cover),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-0.35, -0.45),
                  radius: 1.05,
                  colors: [Color(0x33FFFFFF), Color(0x00FFFFFF), Color(0x47121212)],
                  stops: [0, 0.45, 1],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
