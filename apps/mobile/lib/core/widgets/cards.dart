import 'package:flutter/material.dart';

import '../theme/tokens.dart';
import 'page.dart';

/// `.card` du web : blanc, bordure rgb(32 31 35 / .05), rayon 22 (mobile), ombre lift.
class SuCard extends StatelessWidget {
  const SuCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color, this.border, this.margin, this.radius});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? border;
  final EdgeInsetsGeometry? margin;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius ?? SuRadius.card);
    final card = DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: SuShadows.lift),
      child: Material(
        color: color ?? SuColors.surface,
        shape: RoundedRectangleBorder(borderRadius: r, side: BorderSide(color: border ?? SuColors.cardBorder)),
        clipBehavior: Clip.antiAlias,
        child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
    return margin == null ? card : Padding(padding: margin!, child: card);
  }
}

/// SectionHeader (card.tsx) : titre 15 px semibold encre, sous-titre 13 px soft, action à
/// l'extrémité (lien 13 px action).
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.subtitle, this.actionLabel, this.onAction, this.trailing});
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: t.titleMedium),
                if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: t.bodySmall)),
              ],
            ),
          ),
          if (trailing != null) trailing!,
          if (actionLabel != null)
            TextButton(onPressed: onAction, style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 6), minimumSize: const Size(0, 32)), child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

/// Pastille circulaire teintée (color-icons.tsx IconCircle) : tons sage / lilac / sand / tosca /
/// ok / warn / danger / ink / surface. `action` = sage (ton par défaut du web),
/// `neutral` = surface avec liseré.
enum Tone { action, ink, ok, warn, danger, sand, lilac, tosca, sage, neutral }

class IconCircle extends StatelessWidget {
  const IconCircle(this.icon, {super.key, this.tone = Tone.sage, this.size = 44, this.iconSize});
  final IconData icon;
  final Tone tone;
  final double size;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, Color? border) = switch (tone) {
      Tone.action || Tone.sage => (SuColors.sageTint, SuColors.action, null),
      Tone.ink => (SuColors.ink, Colors.white, null),
      Tone.ok => (SuColors.okTint, SuColors.ok, null),
      Tone.warn => (SuColors.warnTint, SuColors.warn, null),
      Tone.danger => (SuColors.dangerTint, SuColors.danger, null),
      Tone.lilac => (SuColors.lilacTint, SuColors.lilac, null),
      Tone.sand => (SuColors.sandTint, SuColors.sand, null),
      Tone.tosca => (SuColors.toscaTint, SuColors.toscaDeep, null),
      Tone.neutral => (SuColors.surface, SuColors.soft, SuColors.hairline),
    };
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle, border: border == null ? null : Border.all(color: border)),
      child: Icon(icon, color: fg, size: iconSize ?? size * 0.5),
    );
  }
}

/// Tuile statistique (stat-card.tsx, mise en page mobile `.stat` < 640 px) : icône 38 au-dessus,
/// libellé 12.5 px body, valeur 21 px semibold encre, puce de tendance pleine, rayon 20.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.icon, this.tone = Tone.sage, this.hint, this.hintColor, this.onTap});
  final String label;
  final String value;
  final IconData? icon;
  final Tone tone;
  final String? hint;
  final Color? hintColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final trendBg = hintColor == SuColors.danger ? SuColors.danger : hintColor == SuColors.warn ? SuColors.warn : hintColor == SuColors.ok ? SuColors.ok : SuColors.ground;
    final trendFg = trendBg == SuColors.ground ? SuColors.ink : Colors.white;
    return SuCard(
      onTap: onTap,
      radius: SuRadius.tile,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[IconCircle(icon!, tone: tone, size: 38, iconSize: 20), const SizedBox(height: 10)],
          Text(label, style: t.labelMedium?.copyWith(fontSize: 12.5, color: SuColors.body, height: 1.25), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(value, style: t.headlineMedium?.copyWith(fontSize: 21, fontFeatures: const [FontFeature.tabularFigures()]), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (hint != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: hintColor == null
                  ? Text(hint!, style: t.labelSmall?.copyWith(color: SuColors.soft), maxLines: 2, overflow: TextOverflow.ellipsis)
                  : Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: trendBg, borderRadius: BorderRadius.circular(999)),
                      child: Text(hint!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: trendFg), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
            ),
        ],
      ),
    );
  }
}

/// Ligne « clé : valeur ».
class KeyValueRow extends StatelessWidget {
  const KeyValueRow(this.label, this.value, {super.key, this.valueWidget, this.mono = false});
  final String label;
  final String value;
  final Widget? valueWidget;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: t.bodySmall)),
          const SizedBox(width: 12),
          Expanded(
            flex: 3,
            child: valueWidget ??
                Text(value, textAlign: TextAlign.end, style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600, fontFamily: mono ? 'GeistMono' : null, fontFeatures: const [FontFeature.tabularFigures()])),
          ),
        ],
      ),
    );
  }
}

/// ProgressBar (progress.tsx) : piste greige, remplissage action / ok / warn / danger / ink.
class Gauge extends StatelessWidget {
  const Gauge(this.ratio, {super.key, this.height = 8, this.color});
  final double ratio;
  final double height;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final r = ratio.clamp(0.0, 1.0);
    final c = color ?? (r >= 1 ? SuColors.ok : r >= 0.6 ? SuColors.action : SuColors.warn);
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: height,
        child: Stack(children: [Container(color: SuColors.ground), FractionallySizedBox(widthFactor: r, child: Container(color: c))]),
      ),
    );
  }
}

/// Avatar initiales (avatar.tsx) : teinte déterministe dérivée du nom (sage / lilas / sable /
/// tosca / ok) — fond teinté, initiales colorées ; `solid` = encre pleine.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 36, this.color, this.solid = false});
  final String name;
  final double size;
  final Color? color;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials = parts.take(2).map((p) => p.characters.first.toUpperCase()).join();
    int hash = 0;
    for (final r in name.runes) {
      hash = (hash * 31 + r) % 997;
    }
    const tones = [(SuColors.sageTint, SuColors.action), (SuColors.lilacTint, SuColors.lilac), (SuColors.sandTint, SuColors.sand), (SuColors.toscaTint, SuColors.toscaDeep), (SuColors.okTint, SuColors.ok)];
    final tone = tones[hash % tones.length];
    final bg = solid ? SuColors.ink : (color ?? tone.$1);
    final fg = solid || color != null ? Colors.white : tone.$2;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(initials.isEmpty ? '•' : initials, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: (size * 0.34).clamp(10, 40))),
    );
  }
}

/// Montant tabulaire (.tnum).
class MoneyText extends StatelessWidget {
  const MoneyText(this.text, {super.key, this.style, this.color});
  final String text;
  final TextStyle? style;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final base = style ?? Theme.of(context).textTheme.titleMedium;
    return Text(text, style: base?.copyWith(color: color ?? base.color, letterSpacing: -0.15, fontFeatures: const [FontFeature.tabularFigures()]), textDirection: TextDirection.ltr);
  }
}

/// Flèche circulaire de fin de ligne (drill-in) — pastille greige, flèche encre (miroir RTL).
enum ArrowTone { blue, amber, white, whiteAmber }

class CircleArrow extends StatelessWidget {
  const CircleArrow({super.key, this.size = 36, this.tone = ArrowTone.blue, this.onTap});
  final double size;
  final ArrowTone tone;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      ArrowTone.white || ArrowTone.whiteAmber => (SuColors.surface, SuColors.ink),
      ArrowTone.amber => (SuColors.sandTint, SuColors.sand),
      ArrowTone.blue => (SuColors.ground, SuColors.ink),
    };
    final disc = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Icon(Icons.arrow_forward_rounded, size: size * 0.5, color: fg, textDirection: Directionality.of(context)),
    );
    return onTap == null ? disc : InkWell(customBorder: const CircleBorder(), onTap: onTap, child: disc);
  }
}

/// Carte « résidence » du tableau de bord — carte blanche (rayon 24, ombre lift), photo de la
/// résidence à la fin, libellé, statistiques (chiffres tabulaires) et chevron.
class HeroCard extends StatelessWidget {
  const HeroCard({super.key, required this.label, required this.stats, this.onTap, this.image = 'assets/images/residence-hero.jpg', this.imageWidget});
  final String label;
  final List<({String value, String caption})> stats;
  final VoidCallback? onTap;
  final String image;
  final Widget? imageWidget;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SuCard(
      onTap: onTap,
      padding: EdgeInsets.zero,
      radius: 24,
      child: SizedBox(
        height: 168,
        child: Row(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 18, 12, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(label, style: t.bodyMedium?.copyWith(color: SuColors.soft, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (int i = 0; i < stats.length; i++) ...[
                          if (i > 0) const SizedBox(width: 20),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: Text(stats[i].value, style: t.displayLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]))),
                                const SizedBox(height: 2),
                                Text(stats[i].caption, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (onTap != null) const ChevronEnd(size: 32),
                  ],
                ),
              ),
            ),
            ClipRRect(
              borderRadius: const BorderRadiusDirectional.horizontal(end: Radius.circular(24)),
              child: SizedBox(width: 140, height: double.infinity, child: imageWidget ?? Image.asset(image, fit: BoxFit.cover)),
            ),
          ],
        ),
      ),
    );
  }
}
