import 'package:flutter/material.dart';

import '../theme/motion.dart';
import '../theme/tokens.dart';
import 'illustration.dart';
import 'motion.dart';

/// Tuile Wise : bloc greige PLAT (aucune bordure, aucune ombre), grand rayon 24. Posée sur la
/// toile blanche, c'est la couleur — pas le relief — qui sépare les contenus.
class SuCard extends StatelessWidget {
  const SuCard({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap, this.color, this.border, this.margin, this.radius});
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
    final card = Material(
      color: color ?? SuColors.tile,
      shape: RoundedRectangleBorder(borderRadius: r, side: border == null ? BorderSide.none : BorderSide(color: border!, width: 1.2)),
      clipBehavior: Clip.antiAlias,
      child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
    // Carte cliquable : s'enfonce légèrement sous le doigt, rebondit au relâchement.
    final Widget body = onTap == null ? card : SuPressable(child: card);
    return margin == null ? body : Padding(padding: margin!, child: body);
  }
}

/// Titre de section Wise (« Transactions » … « See all ») : 22 px gras encre, lien souligné vert
/// profond à l'extrémité, sous-titre 13,5 soft.
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
      padding: const EdgeInsets.only(top: 30, bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: t.headlineMedium),
                if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(subtitle!, style: t.bodySmall)),
              ],
            ),
          ),
          if (trailing != null) trailing!,
          if (actionLabel != null) LinkButton(actionLabel!, onTap: onAction),
        ],
      ),
    );
  }
}

/// Lien Wise : texte vert profond souligné, sans fond, cible tactile ≥ 44 px.
class LinkButton extends StatelessWidget {
  const LinkButton(this.label, {super.key, this.onTap, this.color});
  final String label;
  final VoidCallback? onTap;
  final Color? color;
  @override
  Widget build(BuildContext context) => TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4), minimumSize: const Size(44, 44), foregroundColor: color),
        child: Text(label),
      );
}

/// Pastille circulaire (lignes de liste Wise : 48 px). Tons teintés de la palette ; `neutral` =
/// voile d'encre (lisible sur blanc comme sur greige), glyphe encre.
enum Tone { action, ink, ok, warn, danger, sand, lilac, tosca, sage, neutral }

class IconCircle extends StatelessWidget {
  const IconCircle(this.icon, {super.key, this.tone = Tone.sage, this.size = 48, this.iconSize});
  final IconData icon;
  final Tone tone;
  final double size;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      Tone.action || Tone.sage => (SuColors.sageTint, SuColors.actionDeep),
      Tone.ink => (SuColors.ink, SuColors.cta),
      Tone.ok => (SuColors.okTint, SuColors.ok),
      Tone.warn => (SuColors.sandMid, SuColors.ink),
      Tone.danger => (SuColors.dangerTint, SuColors.danger),
      Tone.lilac => (SuColors.lilacTint, SuColors.lilac),
      Tone.sand => (SuColors.sandTint, SuColors.sand),
      Tone.tosca => (SuColors.toscaTint, SuColors.toscaDeep),
      Tone.neutral => (SuColors.wash, SuColors.ink),
    };
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      child: Icon(icon, color: fg, size: iconSize ?? size * 0.48),
    );
  }
}

/// Bouton rond Wise (retour, fermer, actions d'en-tête) : disque greige 44 px, glyphe vert profond.
class CircleIconButton extends StatelessWidget {
  const CircleIconButton({super.key, required this.icon, required this.onTap, this.tooltip, this.size = 44, this.color, this.iconColor, this.mirror = false});
  final IconData icon;
  final VoidCallback? onTap;
  final String? tooltip;
  final double size;
  final Color? color;
  final Color? iconColor;
  /// Retourner le glyphe en RTL (flèches).
  final bool mirror;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    Widget glyph = Icon(icon, size: size * 0.5, color: iconColor ?? SuColors.link);
    if (mirror && rtl) glyph = Transform.flip(flipX: true, child: glyph);
    final btn = SuPressable(
      scale: 0.9,
      child: Material(
        color: color ?? SuColors.tile,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: SizedBox(width: size, height: size, child: Center(child: glyph))),
      ),
    );
    return tooltip == null ? btn : Tooltip(message: tooltip!, child: Semantics(button: true, label: tooltip, child: btn));
  }
}

/// Tuile de solde Wise (cartes « Australian Dollar » de l'écran Account) : pastille en haut,
/// grand chiffre gras en bas, libellé dessous. Puce de tendance pleine en option.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.icon, this.tone = Tone.sage, this.hint, this.hintColor, this.onTap, this.minHeight = 150});
  final String label;
  final String value;
  final IconData? icon;
  final Tone tone;
  final String? hint;
  final Color? hintColor;
  final VoidCallback? onTap;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final trendBg = hintColor == SuColors.danger ? SuColors.danger : hintColor == SuColors.warn ? SuColors.warn : hintColor == SuColors.ok ? SuColors.ok : SuColors.surface;
    final trendFg = trendBg == SuColors.surface ? SuColors.ink : Colors.white;
    return SuCard(
      onTap: onTap,
      radius: SuRadius.tile,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: minHeight - 36),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (icon != null) IconCircle(icon!, tone: tone, size: 40, iconSize: 20) else const SizedBox(height: 4),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 22),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerStart,
                  child: AnimatedDigits(value, style: t.displaySmall?.copyWith(fontSize: 26)),
                ),
                const SizedBox(height: 4),
                Text(label, style: t.bodyMedium?.copyWith(height: 1.25), maxLines: 2, overflow: TextOverflow.ellipsis),
                if (hint != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: hintColor == null
                        ? Text(hint!, style: t.labelSmall?.copyWith(color: SuColors.soft), maxLines: 2, overflow: TextOverflow.ellipsis)
                        : Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                            decoration: BoxDecoration(color: trendBg, borderRadius: BorderRadius.circular(999)),
                            child: Text(hint!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: trendFg), maxLines: 1, overflow: TextOverflow.ellipsis),
                          ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Carrousel horizontal de tuiles (soldes Wise) : deux tuiles visibles, la troisième dépasse
/// pour inviter au glissement. Déborde jusqu'aux bords de l'écran (`bleed` = marge de page).
class TileCarousel extends StatelessWidget {
  const TileCarousel({super.key, required this.children, this.bleed = 16, this.visible = 2.18, this.gap = 12, this.height = 176});
  final List<Widget> children;
  final double bleed;
  final double visible;
  final double gap;
  final double height;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final full = c.maxWidth + bleed * 2;
      final w = ((full - bleed - gap * (visible.floor())) / visible).clamp(120.0, 260.0);
      return SizedBox(
        height: height,
        child: OverflowBox(
          minWidth: full,
          maxWidth: full,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(horizontal: bleed),
            physics: const BouncingScrollPhysics(),
            itemCount: children.length,
            separatorBuilder: (_, __) => SizedBox(width: gap),
            itemBuilder: (_, i) => SizedBox(width: w, child: SuEnter(index: i + 1, child: children[i])),
          ),
        ),
      );
    });
  }
}

/// Carte-affiche Wise (« BOOST YOUR USD BALANCE… ») : salle sombre encre, grand titre en
/// capitales d'affiche sauge, accroche blanche au-dessus, visuel optionnel, fermeture ronde.
class PosterCard extends StatelessWidget {
  const PosterCard({super.key, required this.title, this.kicker, this.body, this.image, this.art, this.onTap, this.onClose, this.ctaLabel, this.onCta, this.color = SuColors.ink, this.titleColor = SuColors.cta});
  final String title;
  /// Action du bouton (par défaut : `onTap`).
  final VoidCallback? onCta;
  final String? kicker;
  final String? body;
  final Widget? image;
  /// Affiche texturée (`poster-ag`…) posée en tête si livrée.
  final String? art;
  final VoidCallback? onTap;
  final VoidCallback? onClose;
  final String? ctaLabel;
  final Color color;
  final Color titleColor;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final image = this.image ?? (art != null && SuIllustration.has(art!) ? SuIllustration(art!, fit: BoxFit.cover, fallback: const SizedBox.shrink()) : null);
    return SuCard(
      onTap: onTap,
      color: color,
      padding: EdgeInsets.zero,
      radius: 28,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (image != null) SizedBox(height: 170, child: image),
              Padding(
                padding: EdgeInsets.fromLTRB(22, image == null ? 24 : 16, 22, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (kicker != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(kicker!, style: t.titleMedium?.copyWith(color: Colors.white))),
                    Text(SuType.posterText(context, title), style: SuType.poster(context, 34, color: titleColor)),
                    if (body != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(body!, style: t.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.78)))),
                    if (ctaLabel != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 18),
                        child: FilledButton(onPressed: onCta ?? onTap, style: FilledButton.styleFrom(minimumSize: const Size(0, 46)), child: Text(ctaLabel!)),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (onClose != null)
            PositionedDirectional(
              top: 14,
              end: 14,
              child: CircleIconButton(icon: Icons.close_rounded, onTap: onClose, size: 36, color: Colors.white, iconColor: SuColors.ink, tooltip: MaterialLocalizations.of(context).closeButtonTooltip),
            ),
        ],
      ),
    );
  }
}

/// Ligne « clé : valeur » (frais Wise : libellé gras à gauche, montant à droite).
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
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: t.bodyMedium?.copyWith(color: SuColors.soft))),
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

/// Jauge Wise (barre de progression de l'onboarding) : piste voile d'encre, remplissage plein.
class Gauge extends StatelessWidget {
  const Gauge(this.ratio, {super.key, this.height = 8, this.color});
  final double ratio;
  final double height;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final r = ratio.clamp(0.0, 1.0);
    final c = color ?? (r >= 1 ? SuColors.ok : r >= 0.6 ? SuColors.actionDeep : SuColors.warn);
    // Se remplit au montage (et glisse vers la nouvelle valeur), depuis le début de ligne.
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: height,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: r),
          duration: SuMotion.of(context, const Duration(milliseconds: 900)),
          curve: SuMotion.easeOut,
          builder: (_, v, __) => Stack(
            alignment: AlignmentDirectional.centerStart,
            children: [
              Container(color: SuColors.washStrong),
              FractionallySizedBox(widthFactor: v, heightFactor: 1, alignment: AlignmentDirectional.centerStart, child: DecoratedBox(decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(999)))),
            ],
          ),
        ),
      ),
    );
  }
}

/// Avatar initiales (Wise : disque greige, initiales encre grasses) ; teinte déterministe de la
/// palette quand `tinted` ; `solid` = encre pleine.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 40, this.color, this.solid = false, this.tinted = true});
  final String name;
  final double size;
  final Color? color;
  final bool solid;
  final bool tinted;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials = parts.take(2).map((p) => p.characters.first.toUpperCase()).join();
    int hash = 0;
    for (final r in name.runes) {
      hash = (hash * 31 + r) % 997;
    }
    const tones = [(SuColors.sageTint, SuColors.actionDeep), (SuColors.lilacTint, SuColors.lilac), (SuColors.sandTint, SuColors.sand), (SuColors.toscaTint, SuColors.toscaDeep), (SuColors.okTint, SuColors.ok)];
    final tone = tinted ? tones[hash % tones.length] : (SuColors.tile, SuColors.ink);
    final bg = solid ? SuColors.ink : (color ?? tone.$1);
    final fg = solid || color != null ? Colors.white : tone.$2;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(initials.isEmpty ? '•' : initials, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: (size * 0.36).clamp(10, 40), letterSpacing: -0.3)),
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
    return Text(text, style: base?.copyWith(color: color ?? base.color, fontFeatures: const [FontFeature.tabularFigures()]), textDirection: TextDirection.ltr);
  }
}

/// Flèche de fin de ligne (drill-in) — glyphe vert profond nu (miroir RTL), comme les rangées
/// « Instant verification › » de Wise. Les tons sont conservés pour compatibilité.
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
      ArrowTone.amber => (SuColors.sandMid, SuColors.ink),
      ArrowTone.blue => (SuColors.cta, SuColors.ink),
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

/// Carte « résidence » — tuile greige, photo arrondie à la fin, grands chiffres gras.
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
    return SuEnter(index: 1, child: SuCard(
      onTap: onTap,
      padding: const EdgeInsets.all(8),
      radius: 28,
      child: SizedBox(
        height: 164,
        child: Row(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(label, style: t.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        for (int i = 0; i < stats.length; i++) ...[
                          if (i > 0) const SizedBox(width: 18),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: AnimatedDigits(stats[i].value, style: t.displayMedium)),
                                Text(stats[i].caption, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: SizedBox(width: 128, height: double.infinity, child: imageWidget ?? Image.asset(image, fit: BoxFit.cover)),
            ),
          ],
        ),
      ),
    ));
  }
}
