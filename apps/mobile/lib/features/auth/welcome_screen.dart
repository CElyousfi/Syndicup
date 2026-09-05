import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';

/// Coque des écrans publics — copie du layout `(public)` du web sur mobile : fond greige,
/// en-tête marque + bascule de langue (h-20), contenu centré (max-w-sm), pied 12 px faint.
class PublicScaffold extends StatelessWidget {
  const PublicScaffold({super.key, required this.children, this.showBack = false});
  final List<Widget> children;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Scaffold(
      backgroundColor: SuColors.ground,
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 72,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  children: [
                    if (showBack && context.canPop()) IconButton(onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back_rounded, size: 20), padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 36)),
                    const Brand(),
                    const Spacer(),
                    const LocaleSwitch(),
                  ],
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                children: [Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 400), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)))],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
              child: Text(d.auth.securityNote, style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w400), textAlign: TextAlign.center),
            ),
          ],
        ),
      ),
    );
  }
}

/// Carte image (invitation/page.tsx) : h-32, rayon 24, ombre lift.
class HeroImageCard extends StatelessWidget {
  const HeroImageCard({super.key, this.asset = 'assets/images/residence-hero.jpg', this.height = 128});
  final String asset;
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        margin: const EdgeInsets.only(bottom: 24),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), boxShadow: SuShadows.lift),
        clipBehavior: Clip.antiAlias,
        child: Image.asset(asset, fit: BoxFit.cover),
      );
}

/// A0 — entrée hors session : même contenu que l'aside du layout public du web (accroche +
/// sous-titre de marque), puis les deux chemins : se connecter / j'ai un code.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    return PublicScaffold(
      children: [
        const HeroImageCard(height: 176),
        Text(d.brand.tagline, style: t.displayMedium),
        const SizedBox(height: 6),
        Text(d.brand.subtitle, style: t.bodyMedium?.copyWith(color: SuColors.soft, height: 1.6)),
        const SizedBox(height: 24),
        FilledButton(onPressed: () => context.push('/connexion'), child: Text(d.auth.signIn)),
        const SizedBox(height: 10),
        OutlinedButton.icon(onPressed: () => context.push('/invitation'), icon: const Icon(Icons.qr_code_scanner_rounded, size: 18), label: Text(md.haveCode)),
      ],
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
    return Material(
      color: SuColors.surface,
      shape: const StadiumBorder(side: BorderSide(color: SuColors.hairlineStrong)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: () => LocaleSwitchScope.of(context)?.call(isAr ? const Locale('fr') : const Locale('ar')),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Text(isAr ? 'Français' : 'العربية', style: const TextStyle(color: SuColors.inkStrong, fontSize: 13, fontWeight: FontWeight.w500)),
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
