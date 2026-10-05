import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
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
    HapticFeedback.selectionClick();
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
      (md.ob1Title, md.ob1Body, 'assets/images/residence-hero.jpg', const ResidentCardMock(), 'ob-1-residence'),
      (md.ob2Title, md.ob2Body, 'assets/images/residence-entrance.jpg', const _ChargeCard(), 'ob-2-charges'),
      (md.ob3Title, md.ob3Body, 'assets/images/residence-courtyard.jpg', const _IncidentCard(), 'ob-3-incident'),
      (md.ob4Title, md.ob4Body, 'assets/images/espace-salle.jpg', const _VoteCard(), 'ob-4-ag'),
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
                    return _Slide(title: slides[i].$1, body: slides[i].$2, photo: slides[i].$3, card: slides[i].$4, art: slides[i].$5, delta: delta, active: i == _index);
                  },
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SuPressable(
                    child: FilledButton(
                      onPressed: _next,
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                      child: AnimatedSwitcher(
                        duration: SuMotion.of(context, SuMotion.base),
                        child: Text(last ? md.obStart : md.obNext, key: ValueKey(last)),
                      ),
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
  const _Slide({required this.title, required this.body, required this.photo, required this.card, required this.art, required this.delta, required this.active});
  final String title;
  /// Illustration 3D livrée : elle remplace la sphère photo (la carte flottante reste).
  final String art;
  final String body;
  final String photo;
  final Widget card;
  final double delta;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final reduced = SuMotion.reduced(context);
    final dir = SuMotion.sign(context);
    final h = MediaQuery.sizeOf(context).height;
    final sphere = (h * 0.30).clamp(170.0, 280.0);
    return LayoutBuilder(builder: (context, c) {
      return Column(
        children: [
          Expanded(
            child: Center(
              child: SizedBox(
                width: sphere * 1.45,
                height: sphere * 1.12,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    // La sphère glisse moins vite que la page et tourne légèrement (parallaxe).
                    Transform.translate(
                      offset: Offset(reduced ? 0 : delta * 70 * dir, 0),
                      child: Transform.rotate(angle: reduced ? 0 : delta * 0.25, child: SuIllustration(art, size: sphere * 1.15, fallback: PhotoSphere(asset: photo, size: sphere))),
                    ),
                    // La carte flottante arrive en ressort, plus vite que la sphère.
                    PositionedDirectional(
                      end: 0,
                      bottom: sphere * 0.06,
                      child: Transform.translate(
                        offset: Offset(reduced ? 0 : delta * 160 * dir, 0),
                        child: Transform.rotate(
                          angle: -0.07 * dir,
                          child: active && !reduced
                              ? card.animate(key: ValueKey(photo)).slideY(begin: 0.25, end: 0, duration: 700.ms, delay: 120.ms, curve: SuMotion.spring).fadeIn(duration: 300.ms, delay: 120.ms)
                              : card,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
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

/// Cadre commun des cartes flottantes (rôle de la carte Wise sur le globe).
class _Floating extends StatelessWidget {
  const _Floating({required this.child, this.color = SuColors.surface, this.width = 190});
  final Widget child;
  final Color color;
  final double width;
  @override
  Widget build(BuildContext context) => Container(
        width: width,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20), boxShadow: SuShadows.pop),
        child: child,
      );
}

/// Barre « texte » neutre (aucune langue) pour les maquettes d'interface.
class _Line extends StatelessWidget {
  const _Line(this.w, {this.color = SuColors.washStrong});
  final double w;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(width: w, height: 8, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(99)));
}

/// 1 — carte de résident sauge (la carte Wise), marque en tête.
class ResidentCardMock extends StatelessWidget {
  const ResidentCardMock({super.key});
  @override
  Widget build(BuildContext context) => _Floating(
        color: SuColors.cta,
        width: 200,
        child: SizedBox(
          height: 112,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Align(alignment: AlignmentDirectional.centerEnd, child: BrandWordmark()),
              const Spacer(),
              Row(children: [
                Container(width: 30, height: 22, decoration: BoxDecoration(color: SuColors.sandMid, borderRadius: BorderRadius.circular(5))),
                const SizedBox(width: 10),
                const Icon(Icons.apartment_rounded, size: 20, color: SuColors.actionDeep),
              ]),
              const SizedBox(height: 12),
              const _Line(110, color: Color(0x33121212)),
            ],
          ),
        ),
      );
}

/// 2 — appel de fonds réglé : pastille, jauge pleine, statut « Payé ».
class _ChargeCard extends StatelessWidget {
  const _ChargeCard();
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return _Floating(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(children: [
            const IconCircle(Icons.request_quote_rounded, tone: Tone.sand, size: 38, iconSize: 19),
            const SizedBox(width: 10),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_Line(70), SizedBox(height: 6), _Line(44)])),
          ]),
          const SizedBox(height: 14),
          const Gauge(1, height: 7, color: SuColors.ok),
          const SizedBox(height: 12),
          StatusBadge(d.enums.statutLigne['PAYE'] ?? '✓', variant: BadgeVariant.ok, small: true),
        ],
      ),
    );
  }
}

/// 3 — incident signalé puis résolu.
class _IncidentCard extends StatelessWidget {
  const _IncidentCard();
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return _Floating(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(children: [
            const IconCircle(Icons.photo_camera_rounded, tone: Tone.tosca, size: 38, iconSize: 19),
            const SizedBox(width: 10),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_Line(80), SizedBox(height: 6), _Line(50)])),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            for (int i = 0; i < 3; i++) ...[
              if (i > 0) Expanded(child: Container(height: 2, color: SuColors.ok)),
              Container(width: 18, height: 18, decoration: const BoxDecoration(color: SuColors.ok, shape: BoxShape.circle), child: const Icon(Icons.check_rounded, size: 12, color: Colors.white)),
            ],
          ]),
          const SizedBox(height: 12),
          StatusBadge(d.enums.statutIncident['RESOLU'] ?? '✓', variant: BadgeVariant.ok, small: true),
        ],
      ),
    );
  }
}

/// 4 — résultats de vote (pour / contre / abstention) : jauges et pictogrammes, sans texte.
class _VoteCard extends StatelessWidget {
  const _VoteCard();
  @override
  Widget build(BuildContext context) {
    Widget row(IconData icon, double r, Color c) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Icon(icon, size: 18, color: c),
            const SizedBox(width: 8),
            Expanded(child: Gauge(r, height: 8, color: c)),
          ]),
        );
    return _Floating(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(children: [
            const IconCircle(Icons.how_to_vote_rounded, tone: Tone.lilac, size: 38, iconSize: 19),
            const SizedBox(width: 10),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_Line(76), SizedBox(height: 6), _Line(66)])),
          ]),
          const SizedBox(height: 8),
          row(Icons.check_circle_rounded, 0.72, SuColors.ok),
          row(Icons.cancel_rounded, 0.18, SuColors.danger),
          row(Icons.remove_circle_rounded, 0.10, SuColors.faint),
        ],
      ),
    );
  }
}
