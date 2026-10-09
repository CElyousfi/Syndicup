import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';
import '../onboarding/onboarding_screen.dart';

/// Coque des écrans publics — langage Wise : toile blanche, bouton rond de retour en haut à
/// gauche (ou la marque), pill de langue à droite, contenu en colonne (max 400), mention de
/// sécurité discrète en pied.
class PublicScaffold extends StatelessWidget {
  const PublicScaffold({super.key, required this.children, this.showBack = false});
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final back = showBack && context.canPop();
    return Scaffold(
      backgroundColor: SuColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 72,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    if (back) CircleIconButton(icon: Icons.arrow_back_rounded, mirror: true, tooltip: MaterialLocalizations.of(context).backButtonTooltip, onTap: () => context.pop()) else const Brand(size: 36),
                    const Spacer(),
                    const LocaleSwitch(),
                  ],
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
                // Les blocs de chaque écran public arrivent l'un après l'autre.
                children: [Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 400), child: SuStagger(children: children)))],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_rounded, size: 14, color: SuColors.faint),
                  const SizedBox(width: 6),
                  Flexible(child: Text(d.auth.securityNote, style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w400), textAlign: TextAlign.center)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Carte image (invitation/page.tsx) : grand rayon, à plat.
class HeroImageCard extends StatelessWidget {
  const HeroImageCard({super.key, this.asset = 'assets/images/residence-hero.jpg', this.height = 128});
  final String asset;
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        margin: const EdgeInsets.only(bottom: 24),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(28)),
        clipBehavior: Clip.antiAlias,
        // Travelling arrière à l'ouverture (comme le visuel du web).
        child: SuMotion.reduced(context)
            ? Image.asset(asset, fit: BoxFit.cover)
            : Image.asset(asset, fit: BoxFit.cover).animate().scaleXY(begin: 1.1, end: 1, duration: 1600.ms, curve: SuMotion.easeOut),
      );
}

/// A0 — entrée hors session, en écran d'accueil Wise : la marque, la sphère photo de la
/// résidence et sa carte de résident, le titre-affiche en capitales, puis les deux chemins
/// (se connecter / j'ai un code) en pills pleine largeur.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final reduced = SuMotion.reduced(context);
    final h = MediaQuery.sizeOf(context).height;
    final sphere = (h * 0.27).clamp(150.0, 250.0);
    return Scaffold(
      backgroundColor: SuColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 14),
              const Row(children: [Brand(size: 36), Spacer(), LocaleSwitch()]),
              Expanded(
                child: Center(
                  child: SizedBox(
                    width: sphere * 1.45,
                    height: sphere * 1.1,
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        reduced ? SuIllustration('welcome-hero', size: sphere * 1.15, fallback: PhotoSphere(asset: 'assets/images/residence-hero.jpg', size: sphere)) : SuIllustration('welcome-hero', size: sphere * 1.15, fallback: PhotoSphere(asset: 'assets/images/residence-hero.jpg', size: sphere)).animate().scaleXY(begin: 0.86, end: 1, duration: 900.ms, curve: SuMotion.easeOut).fadeIn(duration: 500.ms),
                        PositionedDirectional(
                          end: 0,
                          bottom: sphere * 0.04,
                          child: Transform.rotate(
                            angle: -0.07 * SuMotion.sign(context),
                            child: reduced ? const ResidentCardMock() : const ResidentCardMock().animate().slideY(begin: 0.35, end: 0, duration: 800.ms, delay: 250.ms, curve: SuMotion.spring).fadeIn(duration: 300.ms, delay: 250.ms),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SuEnter(index: 2, child: Text(SuType.posterText(context, md.welcomeTitle), textAlign: TextAlign.center, style: SuType.poster(context, ((MediaQuery.sizeOf(context).width - 48) * 0.1).clamp(28.0, 44.0)))),
              const SizedBox(height: 12),
              SuEnter(index: 3, child: Text(d.brand.subtitle, textAlign: TextAlign.center, style: t.bodyLarge?.copyWith(color: SuColors.soft, height: 1.5))),
              const SizedBox(height: 26),
              SuEnter(index: 4, child: SuButton(label: d.auth.signIn, onPressed: () => context.push('/connexion'), size: SuButtonSize.lg, expand: true)),
              const SizedBox(height: 10),
              SuEnter(index: 5, child: SuButton(label: md.haveCode, icon: Icons.qr_code_scanner_rounded, variant: SuButtonVariant.secondary, onPressed: () => context.push('/invitation'), size: SuButtonSize.lg, expand: true)),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_rounded, size: 14, color: SuColors.faint),
                  const SizedBox(width: 6),
                  Flexible(child: Text(d.auth.securityNote, style: t.labelSmall?.copyWith(fontWeight: FontWeight.w400), textAlign: TextAlign.center, maxLines: 2)),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bascule FR/AR (locale-switch du web) : pill secondaire.
class LocaleSwitch extends StatelessWidget {
  const LocaleSwitch({super.key, this.light = false});
  final bool light;
  @override
  Widget build(BuildContext context) {
    final isAr = context.isRtl;
    // Pill greige Wise : globe + langue cible.
    return Material(
      color: SuColors.tile,
      shape: const StadiumBorder(),
      child: SuTap(
        customBorder: const StadiumBorder(),
        onTap: () => LocaleSwitchScope.of(context)?.call(isAr ? const Locale('fr') : const Locale('ar')),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.language_rounded, size: 17, color: SuColors.link),
              const SizedBox(width: 6),
              Text(isAr ? 'Français' : 'العربية', style: const TextStyle(color: SuColors.ink, fontSize: 14, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Injecte le changement de langue sans dépendre de Riverpod dans les widgets purs.
class LocaleSwitchScope extends InheritedWidget {
  const LocaleSwitchScope({super.key, required this.onChange, required super.child});
  final void Function(Locale) onChange;
  static void Function(Locale)? of(BuildContext c) => c.dependOnInheritedWidgetOfExactType<LocaleSwitchScope>()?.onChange;
  @override
  bool updateShouldNotify(LocaleSwitchScope old) => false;
}
