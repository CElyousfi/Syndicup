import 'dart:io' show File;
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../feel/feel.dart';
import '../format/format.dart';
import '../theme/motion.dart';
import '../theme/tokens.dart';
import 'motion.dart';

/// Primitives « Alive » (docs/ALIVE_GUIDE.md) — chaque écran passe par elles, jamais par
/// InkWell / FilledButton / Text(formatMAD…) / Image.network bruts (scripts/alive/check-alive.mjs).
/// Quand `alive_v1` est coupé, chacune redevient la primitive d'avant (aucune régression).

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Surfaces pressables
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Surface pressable générique (remplace InkWell / GestureDetector) : enfoncement en ressort,
/// encre Material, haptique optionnelle, appui long qui « soulève » l'élément (ombre + échelle).
class SuTap extends StatefulWidget {
  const SuTap({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.borderRadius,
    this.customBorder,
    this.scale = SuTokens.pressCard,
    this.haptic = false,
    this.enabled = true,
    this.ink = true,
    this.behavior = HitTestBehavior.opaque,
    this.semanticLabel,
  });
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius? borderRadius;
  final ShapeBorder? customBorder;
  final double scale;

  /// `tap()` haptique au toucher validé (actions principales uniquement).
  final bool haptic;
  final bool enabled;

  /// false : pas d'encre (surfaces déjà décorées, images, zones de geste).
  final bool ink;
  final HitTestBehavior behavior;
  final String? semanticLabel;

  @override
  State<SuTap> createState() => _SuTapState();
}

class _SuTapState extends State<SuTap> {
  bool _lifted = false;

  void _tap() {
    if (widget.haptic) Haptics.tap();
    widget.onTap?.call();
  }

  void _long() {
    if (Feel.alive && !SuMotion.reduced(context)) setState(() => _lifted = true);
    Haptics.select();
    widget.onLongPress?.call();
  }

  void _drop() {
    if (_lifted && mounted) setState(() => _lifted = false);
  }

  @override
  Widget build(BuildContext context) {
    final can = widget.enabled && (widget.onTap != null || widget.onLongPress != null);
    Widget body = widget.ink
        ? Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: can && widget.onTap != null ? _tap : null,
              onLongPress: can && widget.onLongPress != null ? _long : null,
              borderRadius: widget.borderRadius,
              customBorder: widget.customBorder,
              child: widget.child,
            ),
          )
        : GestureDetector(
            behavior: widget.behavior,
            onTap: can && widget.onTap != null ? _tap : null,
            onLongPress: can && widget.onLongPress != null ? _long : null,
            child: widget.child,
          );
    if (widget.semanticLabel != null) body = Semantics(button: true, label: widget.semanticLabel, child: body);
    if (!Feel.alive) return body;
    body = SuPressable(enabled: can, scale: widget.scale, child: body);
    if (widget.onLongPress == null) return body;
    final reduced = SuMotion.reduced(context);
    return Listener(
      onPointerUp: (_) => _drop(),
      onPointerCancel: (_) => _drop(),
      child: AnimatedScale(
        scale: _lifted ? 1.03 : 1,
        duration: reduced ? Duration.zero : SuTokens.base,
        curve: SuMotion.spring,
        child: AnimatedContainer(
          duration: reduced ? Duration.zero : SuTokens.base,
          curve: SuMotion.easeOut,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(18),
            boxShadow: _lifted ? SuShadows.pop : const [],
          ),
          child: body,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Secousse (erreur) — miroir RTL
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Secoue son enfant à chaque changement de [trigger] (non nul) : refus, erreur de saisie.
/// Le premier mouvement part vers la FIN de ligne (miroir en arabe) ; en « animations
/// réduites », simple clignement d'opacité.
class SuShake extends StatefulWidget {
  const SuShake({super.key, required this.trigger, required this.child, this.distance = 8});
  final Object? trigger;
  final Widget child;
  final double distance;
  @override
  State<SuShake> createState() => _SuShakeState();
}

class _SuShakeState extends State<SuShake> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 460));

  @override
  void didUpdateWidget(SuShake old) {
    super.didUpdateWidget(old);
    if (widget.trigger != null && widget.trigger != old.trigger && Feel.alive) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = SuMotion.reduced(context);
    final sign = SuMotion.sign(context);
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = _c.value;
        if (t == 0 || t == 1) return child!;
        if (reduced) return Opacity(opacity: 0.55 + 0.45 * (1 - math.sin(t * math.pi)), child: child);
        final dx = math.sin(t * math.pi * 6) * widget.distance * (1 - t) * sign;
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Boutons
// ─────────────────────────────────────────────────────────────────────────────────────────────

enum SuButtonVariant { primary, secondary, ghost, danger }

enum SuButtonSize { sm, md, lg }

/// Bouton vivant (remplace FilledButton / OutlinedButton / TextButton) :
///  - enfoncement ressort, `tap()` haptique sur les actions principales ;
///  - `loading` : le libellé se change en indicateur DANS le bouton (largeur fixe) ;
///  - fin de chargement sans échec : coche qui se trace (900 ms) puis retour au libellé ;
///  - [fail] nouveau (non nul) : secousse + `warning()` ;
///  - désactivé : couleurs Material animées (jamais de saut).
class SuButton extends StatefulWidget {
  const SuButton({
    super.key,
    this.label,
    this.child,
    required this.onPressed,
    this.icon,
    this.variant = SuButtonVariant.primary,
    this.size = SuButtonSize.md,
    this.expand = false,
    this.loading = false,
    this.fail,
    this.showSuccess = true,
    this.style,
    this.haptic,
    this.onLongPress,
  }) : assert(label != null || child != null);

  final String? label;
  final Widget? child;
  final VoidCallback? onPressed;
  final VoidCallback? onLongPress;
  final IconData? icon;
  final SuButtonVariant variant;
  final SuButtonSize size;
  final bool expand;
  final bool loading;
  final Object? fail;
  final bool showSuccess;
  final ButtonStyle? style;

  /// Défaut : `tap()` pour primary / danger.
  final bool? haptic;

  @override
  State<SuButton> createState() => _SuButtonState();
}

class _SuButtonState extends State<SuButton> {
  bool _done = false;
  int _shake = 0;

  @override
  void didUpdateWidget(SuButton old) {
    super.didUpdateWidget(old);
    if (!Feel.alive) return;
    if (widget.fail != null && !identical(widget.fail, old.fail)) {
      _shake++;
      Haptics.warning();
    } else if (old.loading && !widget.loading && widget.fail == null && widget.showSuccess) {
      setState(() => _done = true);
      Future<void>.delayed(const Duration(milliseconds: 900), () {
        if (mounted) setState(() => _done = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.variant;
    final fg = switch (v) {
      SuButtonVariant.primary => SuColors.onCta,
      SuButtonVariant.danger => Colors.white,
      _ => SuColors.link,
    };
    final minH = switch (widget.size) { SuButtonSize.sm => 40.0, SuButtonSize.md => 48.0, SuButtonSize.lg => 56.0 };
    final sizing = ButtonStyle(minimumSize: WidgetStatePropertyAll(Size(widget.expand ? double.infinity : 0, minH)));
    var style = sizing;
    if (v == SuButtonVariant.danger) style = style.merge(FilledButton.styleFrom(backgroundColor: SuColors.danger, foregroundColor: Colors.white));
    if (widget.style != null) style = widget.style!.merge(style);

    final Widget labelRow = widget.child ??
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.icon != null) ...[Icon(widget.icon, size: 20), const SizedBox(width: 8)],
            Flexible(child: Text(widget.label!, overflow: TextOverflow.ellipsis)),
          ],
        );
    final Widget content;
    if (widget.loading) {
      content = SizedBox(key: const ValueKey('spin'), width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: fg));
    } else if (_done) {
      content = _DrawnCheck(key: const ValueKey('done'), color: fg, size: 22);
    } else {
      content = KeyedSubtree(key: const ValueKey('label'), child: labelRow);
    }
    final swap = AnimatedSwitcher(
      duration: SuMotion.of(context, const Duration(milliseconds: 240)),
      switchInCurve: SuMotion.easeOut,
      switchOutCurve: SuMotion.easeIn,
      transitionBuilder: (c, a) => FadeTransition(opacity: a, child: ScaleTransition(scale: Tween(begin: 0.7, end: 1.0).animate(a), child: c)),
      child: content,
    );
    final enabled = !widget.loading && widget.onPressed != null;
    final haptic = widget.haptic ?? (v == SuButtonVariant.primary || v == SuButtonVariant.danger);
    final VoidCallback? press = enabled
        ? () {
            if (haptic) Haptics.tap();
            widget.onPressed!();
          }
        : null;
    final Widget button = switch (v) {
      SuButtonVariant.primary || SuButtonVariant.danger => FilledButton(onPressed: press, onLongPress: widget.onLongPress, style: style, child: swap),
      SuButtonVariant.secondary => OutlinedButton(onPressed: press, onLongPress: widget.onLongPress, style: style, child: swap),
      SuButtonVariant.ghost => TextButton(onPressed: press, onLongPress: widget.onLongPress, style: style, child: swap),
    };
    final pressed = SuPressable(enabled: enabled, scale: SuTokens.pressButton, child: button);
    return SuShake(trigger: _shake == 0 ? null : _shake, child: pressed);
  }
}

/// Coche qui se trace (succès d'un bouton, case cochée).
class _DrawnCheck extends StatelessWidget {
  const _DrawnCheck({super.key, required this.color, this.size = 22});
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: SuMotion.reduced(context) ? 1 : 0, end: 1),
        duration: SuTokens.slow,
        curve: SuMotion.easeOut,
        builder: (_, t, __) => CustomPaint(size: Size.square(size), painter: CheckPainter(progress: t, color: color, stroke: size * 0.12)),
      );
}

/// Peintre de coche tracée progressivement (0 → 1).
class CheckPainter extends CustomPainter {
  CheckPainter({required this.progress, required this.color, this.stroke = 2.4});
  final double progress;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size s) {
    if (progress <= 0) return;
    final path = Path()
      ..moveTo(s.width * 0.2, s.height * 0.52)
      ..lineTo(s.width * 0.42, s.height * 0.74)
      ..lineTo(s.width * 0.82, s.height * 0.3);
    final m = path.computeMetrics().first;
    canvas.drawPath(
      m.extractPath(0, m.length * progress.clamp(0.0, 1.0)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(CheckPainter old) => old.progress != progress || old.color != color;
}

/// Bouton-icône vivant (remplace IconButton) : enfoncement 0,9, et MORPHING quand l'icône
/// change (menu ↔ fermer, cloche → cloche pointée, étoile, lecture/pause).
class SuIconButton extends StatelessWidget {
  const SuIconButton({super.key, required this.icon, required this.onPressed, this.tooltip, this.color, this.iconSize = 24, this.selected = false, this.selectedIcon, this.padding});
  final IconData icon;
  final IconData? selectedIcon;
  final bool selected;
  final VoidCallback? onPressed;
  final String? tooltip;
  final Color? color;
  final double iconSize;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final shown = selected && selectedIcon != null ? selectedIcon! : icon;
    final glyph = AnimatedSwitcher(
      duration: SuMotion.of(context, SuTokens.base),
      switchInCurve: SuMotion.spring,
      switchOutCurve: SuMotion.easeIn,
      transitionBuilder: (c, a) => RotationTransition(
        turns: Tween(begin: -0.12, end: 0.0).animate(a),
        child: ScaleTransition(scale: Tween(begin: 0.4, end: 1.0).animate(a), child: FadeTransition(opacity: a, child: c)),
      ),
      child: Icon(shown, key: ValueKey(shown), color: color, size: iconSize),
    );
    return SuPressable(
      enabled: onPressed != null,
      scale: SuTokens.pressIcon,
      child: IconButton(onPressed: onPressed, tooltip: tooltip, icon: glyph, padding: padding, isSelected: selected),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Nombres
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Comparaison exacte de deux nombres FORMATÉS (« 1 250,00 MAD », « 12,5 % ») sans float :
/// partie entière (BigInt) puis décimales normalisées sur 4 chiffres. null si non comparable.
int? compareFigures(String a, String b) {
  (BigInt, bool)? parse(String s) {
    final neg = s.contains('-') || s.contains('−');
    final m = RegExp(r'(\d[\d\s  ]*)(?:[.,](\d+))?').firstMatch(s);
    if (m == null) return null;
    final ent = m.group(1)!.replaceAll(RegExp(r'\D'), '');
    final dec = '${m.group(2) ?? ''}0000'.substring(0, 4);
    final v = BigInt.parse('$ent$dec');
    return (neg ? -v : v, true);
  }

  final x = parse(a);
  final y = parse(b);
  if (x == null || y == null) return null;
  return x.$1.compareTo(y.$1).sign;
}

/// Nombre formaté VIVANT : au premier affichage, texte simple (aucune animation dans une liste
/// qui se charge) ; à chaque changement de valeur, les chiffres qui changent roulent vers la
/// nouvelle valeur, avec une teinte brève verte (hausse) ou rouge (baisse). Aucun calcul sur le
/// montant : on anime les caractères de la chaîne déjà formatée.
class AnimatedFigureText extends StatefulWidget {
  const AnimatedFigureText(this.text, {super.key, this.style, this.textAlign, this.maxLines = 1, this.overflow = TextOverflow.ellipsis, this.textDirection, this.tint = true, this.upIsGood = true, this.softWrap});
  final String text;
  final TextStyle? style;
  final TextAlign? textAlign;
  final int? maxLines;
  final TextOverflow overflow;
  final TextDirection? textDirection;
  final bool tint;
  final bool? softWrap;

  /// false pour un montant dont la hausse est une mauvaise nouvelle (impayés, retard).
  final bool upIsGood;

  @override
  State<AnimatedFigureText> createState() => _AnimatedFigureTextState();
}

class _AnimatedFigureTextState extends State<AnimatedFigureText> with TickerProviderStateMixin {
  late final AnimationController _roll = AnimationController(vsync: this, duration: SuTokens.number);
  late final AnimationController _glow = AnimationController(vsync: this, duration: SuTokens.highlight);
  String? _from;
  int _dir = 0;

  @override
  void didUpdateWidget(AnimatedFigureText old) {
    super.didUpdateWidget(old);
    if (old.text == widget.text || !Feel.alive) return;
    final cmp = compareFigures(widget.text, old.text);
    _dir = cmp ?? 0;
    _from = old.text;
    if (SuMotion.reduced(context)) {
      _roll.value = 1;
    } else {
      _roll.forward(from: 0);
    }
    if (widget.tint && _dir != 0) _glow.forward(from: 0);
  }

  @override
  void dispose() {
    _roll.dispose();
    _glow.dispose();
    super.dispose();
  }

  Color? _tint(Color? base) {
    if (_glow.value == 0 || _glow.value == 1 || _dir == 0) return base;
    final good = (_dir > 0) == widget.upIsGood;
    final c = good ? SuColors.ok : SuColors.danger;
    return Color.lerp(c, base ?? SuColors.ink, Curves.easeIn.transform(_glow.value));
  }

  @override
  Widget build(BuildContext context) {
    final base = (widget.style ?? DefaultTextStyle.of(context).style).copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
    return AnimatedBuilder(
      animation: Listenable.merge([_roll, _glow]),
      builder: (context, _) {
        final style = base.copyWith(color: _tint(base.color));
        final rolling = _from != null && _roll.isAnimating;
        if (!rolling) {
          return Text(widget.text, style: style, textAlign: widget.textAlign, maxLines: widget.maxLines, overflow: widget.overflow, textDirection: widget.textDirection, softWrap: widget.softWrap);
        }
        // Alignement par la FIN : unités sous unités, même si la longueur change.
        final to = widget.text;
        final n = math.max(to.length, _from!.length);
        final a = _from!.padLeft(n);
        final b = to.padLeft(n);
        final children = <Widget>[];
        int changed = 0;
        for (int i = 0; i < n; i++) {
          final ca = a[i];
          final cb = b[i];
          if (ca == cb) {
            if (cb != ' ' || i >= n - to.length) children.add(Text(cb, style: style));
            continue;
          }
          final delay = (changed++ * 0.04).clamp(0.0, 0.3);
          final t = ((_roll.value - delay) / (1 - delay)).clamp(0.0, 1.0);
          children.add(_RollChar(from: ca, to: cb, t: SuMotion.easeOut.transform(t), up: _dir >= 0, style: style));
        }
        final align = switch (widget.textAlign) {
          TextAlign.end || TextAlign.right => AlignmentDirectional.centerEnd,
          TextAlign.center => AlignmentDirectional.center,
          _ => AlignmentDirectional.centerStart,
        };
        return Semantics(
          label: widget.text,
          excludeSemantics: true,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: align,
            child: Row(mainAxisSize: MainAxisSize.min, textDirection: TextDirection.ltr, children: children),
          ),
        );
      },
    );
  }
}

class _RollChar extends StatelessWidget {
  const _RollChar({required this.from, required this.to, required this.t, required this.up, required this.style});
  final String from;
  final String to;
  final double t;
  final bool up;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final dir = up ? -1.0 : 1.0;
    return ClipRect(
      child: Stack(
        children: [
          Opacity(opacity: 0, child: Text(to.trim().isEmpty ? from : to, style: style)),
          if (from.trim().isNotEmpty)
            Positioned.fill(
              child: FractionalTranslation(
                translation: Offset(0, dir * t),
                child: Opacity(opacity: 1 - t, child: Text(from, style: style, textAlign: TextAlign.center)),
              ),
            ),
          if (to.trim().isNotEmpty)
            Positioned.fill(
              child: FractionalTranslation(
                translation: Offset(0, -dir * (1 - t)),
                child: Opacity(opacity: t, child: Text(to, style: style, textAlign: TextAlign.center)),
              ),
            ),
        ],
      ),
    );
  }
}

/// Montant vivant : `value` au format API (« 1250.50 »), formaté exactement comme partout
/// (`formatMAD`, ou `formatMontant` sans devise) puis animé seulement quand il CHANGE.
class AnimatedAmount extends StatelessWidget {
  const AnimatedAmount(this.value, {super.key, this.style, this.textAlign, this.currency = true, this.maxLines = 1, this.textDirection, this.upIsGood = true, this.prefix = '', this.suffix = ''});
  final String? value;
  final TextStyle? style;
  final TextAlign? textAlign;
  final bool currency;
  final int? maxLines;
  final TextDirection? textDirection;
  final bool upIsGood;
  final String prefix;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    final text = currency ? formatMAD(value, Localizations.localeOf(context)) : formatMontant(value);
    return AnimatedFigureText('$prefix$text$suffix', style: style, textAlign: textAlign, maxLines: maxLines, textDirection: textDirection, upIsGood: upIsGood);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Bascule de contenu (textes d'état)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Fondu enchaîné quand [value] change (libellé d'état, filtre, compteur textuel) — rien ne
/// change d'un coup. Disposition : l'enfant entrant pose la taille, aligné au début.
class SuFadeSwitch extends StatelessWidget {
  const SuFadeSwitch({super.key, required this.value, required this.child, this.alignment = AlignmentDirectional.topStart, this.slide = true});
  final Object? value;
  final Widget child;
  final AlignmentGeometry alignment;
  final bool slide;

  @override
  Widget build(BuildContext context) {
    if (!Feel.alive) return child;
    return AnimatedSwitcher(
      duration: SuMotion.of(context, SuTokens.base),
      reverseDuration: SuMotion.of(context, SuTokens.fast),
      switchInCurve: SuMotion.easeOut,
      switchOutCurve: SuMotion.easeIn,
      layoutBuilder: (current, previous) => Stack(alignment: alignment, children: [...previous, if (current != null) current]),
      transitionBuilder: (c, a) => FadeTransition(
        opacity: a,
        child: slide && !SuMotion.reduced(context) ? SlideTransition(position: Tween(begin: const Offset(0, 0.02), end: Offset.zero).animate(a), child: c) : c,
      ),
      child: KeyedSubtree(key: ValueKey(value), child: child),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Images
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Image vivante (remplace Image.network / file / memory) : se pose en fondu avec un léger
/// dézoom, jamais d'un coup ; `heroTag` pour l'ouvrir en zoom depuis sa vignette.
class SuImage extends StatelessWidget {
  const SuImage._({super.key, required this.provider, this.fit = BoxFit.cover, this.width, this.height, this.heroTag, this.errorBuilder, this.semanticLabel, this.alignment = Alignment.center});

  factory SuImage.network(String url, {Key? key, BoxFit fit = BoxFit.cover, double? width, double? height, Object? heroTag, ImageErrorWidgetBuilder? errorBuilder, String? semanticLabel, Map<String, String>? headers, Alignment alignment = Alignment.center}) =>
      SuImage._(key: key, provider: NetworkImage(url, headers: headers), fit: fit, width: width, height: height, heroTag: heroTag, errorBuilder: errorBuilder, semanticLabel: semanticLabel, alignment: alignment);

  factory SuImage.file(File file, {Key? key, BoxFit fit = BoxFit.cover, double? width, double? height, Object? heroTag, ImageErrorWidgetBuilder? errorBuilder, String? semanticLabel, Alignment alignment = Alignment.center}) =>
      SuImage._(key: key, provider: FileImage(file), fit: fit, width: width, height: height, heroTag: heroTag, errorBuilder: errorBuilder, semanticLabel: semanticLabel, alignment: alignment);

  factory SuImage.memory(Uint8List bytes, {Key? key, BoxFit fit = BoxFit.cover, double? width, double? height, Object? heroTag, ImageErrorWidgetBuilder? errorBuilder, String? semanticLabel, Alignment alignment = Alignment.center}) =>
      SuImage._(key: key, provider: MemoryImage(bytes), fit: fit, width: width, height: height, heroTag: heroTag, errorBuilder: errorBuilder, semanticLabel: semanticLabel, alignment: alignment);

  final ImageProvider provider;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Object? heroTag;
  final ImageErrorWidgetBuilder? errorBuilder;
  final String? semanticLabel;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final img = Image(
      image: provider,
      fit: fit,
      width: width,
      height: height,
      alignment: alignment,
      semanticLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
      gaplessPlayback: true,
      errorBuilder: errorBuilder ?? (_, __, ___) => Container(color: SuColors.tile, width: width, height: height),
      frameBuilder: (context, child, frame, sync) {
        if (sync || !Feel.alive) return child;
        final shown = frame != null;
        return ColoredBox(
          color: shown ? Colors.transparent : SuColors.tile,
          child: AnimatedOpacity(
            opacity: shown ? 1 : 0,
            duration: SuMotion.of(context, const Duration(milliseconds: 500)),
            curve: SuMotion.easeOut,
            child: AnimatedScale(scale: shown ? 1 : 1.04, duration: SuMotion.of(context, const Duration(milliseconds: 900)), curve: SuMotion.easeOut, child: child),
          ),
        );
      },
    );
    return heroTag == null ? img : Hero(tag: heroTag!, child: img);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Progression
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Anneau de progression : se trace au premier affichage, glisse vers la nouvelle valeur.
/// [glow] : halo unique et retenu (résidence 100 % à jour, une fois par période).
class SuRing extends StatelessWidget {
  const SuRing(this.ratio, {super.key, this.size = 64, this.stroke = 7, this.color, this.track, this.child, this.glow = false});
  final double ratio;
  final double size;
  final double stroke;
  final Color? color;
  final Color? track;
  final Widget? child;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    final r = ratio.clamp(0.0, 1.0);
    final c = color ?? (r >= 1 ? SuColors.ok : r >= 0.6 ? SuColors.brand : SuColors.warn);
    return SizedBox.square(
      dimension: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: r),
        duration: SuMotion.of(context, const Duration(milliseconds: 1100)),
        curve: SuMotion.easeOut,
        builder: (context, v, ch) => CustomPaint(
          painter: _RingPainter(value: v, color: c, track: track ?? SuColors.washStrong, stroke: stroke, rtl: Directionality.of(context) == TextDirection.rtl),
          child: Center(child: ch),
        ),
        child: glow && Feel.ambient(context) ? _Glow(color: c, child: child ?? const SizedBox()) : child,
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.value, required this.color, required this.track, required this.stroke, required this.rtl});
  final double value;
  final Color color;
  final Color track;
  final double stroke;
  final bool rtl;

  @override
  void paint(Canvas canvas, Size s) {
    final rect = Offset.zero & s;
    final r = rect.deflate(stroke / 2);
    canvas.drawArc(r, 0, math.pi * 2, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track);
    if (value <= 0) return;
    // Sens horaire en LTR, antihoraire en arabe (sens de lecture).
    canvas.drawArc(r, -math.pi / 2, (rtl ? -1 : 1) * math.pi * 2 * value, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color);
  }

  @override
  bool shouldRepaint(_RingPainter o) => o.value != value || o.color != color || o.rtl != rtl;
}

class _Glow extends StatelessWidget {
  const _Glow({required this.color, required this.child});
  final Color color;
  final Widget child;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 1600),
        builder: (_, t, ch) => DecoratedBox(
          decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: color.withValues(alpha: 0.35 * math.sin(t * math.pi)), blurRadius: 18, spreadRadius: 2)]),
          child: ch,
        ),
        child: child,
      );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Tirer pour actualiser
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Tirer-pour-actualiser SyndicUp (remplace RefreshIndicator) : disque blanc au double chevron
/// de marque qui suit le geste, devient lime au seuil (`select()` haptique), tourne en ressort
/// pendant le chargement, puis se ferme sur une coche.
class SuRefresh extends StatefulWidget {
  const SuRefresh({super.key, required this.onRefresh, required this.child});
  final Future<void> Function() onRefresh;
  final Widget child;
  @override
  State<SuRefresh> createState() => _SuRefreshState();
}

class _SuRefreshState extends State<SuRefresh> with SingleTickerProviderStateMixin {
  RefreshIndicatorStatus? _status;
  bool _done = false;
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  void _onStatus(RefreshIndicatorStatus? s) {
    if (!mounted) return;
    if (s == RefreshIndicatorStatus.armed && _status != RefreshIndicatorStatus.armed) Haptics.select();
    if (s == RefreshIndicatorStatus.refresh && !SuMotion.reduced(context)) _spin.repeat();
    if (s != RefreshIndicatorStatus.refresh) _spin.stop();
    setState(() => _status = s);
  }

  Future<void> _refresh() async {
    await widget.onRefresh();
    if (!mounted) return;
    setState(() => _done = true);
    await Future<void>.delayed(const Duration(milliseconds: 420));
    if (mounted) setState(() => _done = false);
  }

  @override
  Widget build(BuildContext context) {
    if (!Feel.alive) {
      return RefreshIndicator(onRefresh: widget.onRefresh, color: SuColors.link, backgroundColor: SuColors.surface, child: widget.child);
    }
    final s = _status;
    final visible = s != null && s != RefreshIndicatorStatus.canceled && s != RefreshIndicatorStatus.done || _done;
    final armed = s == RefreshIndicatorStatus.armed || s == RefreshIndicatorStatus.snap || s == RefreshIndicatorStatus.refresh;
    final reduced = SuMotion.reduced(context);
    return Stack(
      children: [
        RefreshIndicator.noSpinner(onRefresh: _refresh, onStatusChange: _onStatus, child: widget.child),
        PositionedDirectional(
          top: 10,
          start: 0,
          end: 0,
          child: IgnorePointer(
            child: Center(
              child: AnimatedOpacity(
                opacity: visible ? 1 : 0,
                duration: SuMotion.of(context, SuTokens.fast),
                child: AnimatedScale(
                  scale: visible ? (armed ? 1 : 0.8) : 0.5,
                  duration: reduced ? Duration.zero : SuTokens.base,
                  curve: SuMotion.spring,
                  child: AnimatedContainer(
                    duration: SuMotion.of(context, SuTokens.toggle),
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(color: armed ? SuColors.cta : SuColors.surface, shape: BoxShape.circle, boxShadow: SuShadows.pop),
                    child: Center(
                      child: _done
                          ? const SizedBox.square(dimension: 20, child: _DrawnCheck(color: SuColors.ink, size: 20))
                          : RotationTransition(turns: _spin, child: const Icon(Icons.keyboard_double_arrow_up_rounded, size: 22, color: SuColors.brand)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Listes vivantes
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Colonne dont les enfants CLÉS entrent (dépli + fondu + surlignage bref) et sortent (repli)
/// quand la liste change — premier rendu sans animation (la cascade d'entrée s'en charge).
/// Un enfant sans clé est rendu tel quel.
class SuLiveColumn extends StatefulWidget {
  const SuLiveColumn({super.key, required this.children, this.crossAxisAlignment = CrossAxisAlignment.stretch, this.highlight = true});
  final List<Widget> children;
  final CrossAxisAlignment crossAxisAlignment;
  final bool highlight;
  @override
  State<SuLiveColumn> createState() => _SuLiveColumnState();
}

class _LiveEntry {
  _LiveEntry(this.widget, {this.entering = false});
  Widget widget;
  bool entering;
  bool leaving = false;
}

class _SuLiveColumnState extends State<SuLiveColumn> {
  final List<_LiveEntry> _entries = [];

  @override
  void initState() {
    super.initState();
    _entries.addAll(widget.children.map((w) => _LiveEntry(w)));
  }

  @override
  void didUpdateWidget(SuLiveColumn old) {
    super.didUpdateWidget(old);
    final animate = Feel.alive;
    final nextKeys = {for (final w in widget.children) if (w.key != null) w.key};
    final prevKeys = {for (final e in _entries) if (e.widget.key != null && !e.leaving) e.widget.key};
    final merged = <_LiveEntry>[];
    final byKey = {for (final e in _entries) if (e.widget.key != null) e.widget.key: e};
    // Les nouveaux enfants, dans leur ordre ; les sortants restent à leur place le temps du repli.
    int iOld = 0;
    for (final w in widget.children) {
      while (iOld < _entries.length && _entries[iOld].widget.key != null && !nextKeys.contains(_entries[iOld].widget.key)) {
        final e = _entries[iOld++];
        if (animate) {
          e.leaving = true;
          merged.add(e);
        }
      }
      if (iOld < _entries.length && _entries[iOld].widget.key == w.key) iOld++;
      final k = w.key;
      if (k != null && byKey.containsKey(k)) {
        final e = byKey[k]!..widget = w;
        e.leaving = false;
        merged.add(e);
      } else {
        merged.add(_LiveEntry(w, entering: animate && k != null && prevKeys.isNotEmpty));
      }
    }
    for (; iOld < _entries.length; iOld++) {
      final e = _entries[iOld];
      if (animate && e.widget.key != null && !nextKeys.contains(e.widget.key)) {
        e.leaving = true;
        merged.add(e);
      }
    }
    _entries
      ..clear()
      ..addAll(merged);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: widget.crossAxisAlignment,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final e in _entries)
          if (e.widget.key == null)
            e.widget
          else
            _LiveItem(
              key: ValueKey(('live', e.widget.key)),
              entering: e.entering,
              leaving: e.leaving,
              highlight: widget.highlight,
              onGone: () {
                if (!mounted) return;
                setState(() => _entries.remove(e));
              },
              child: e.widget,
            ),
      ],
    );
  }
}

class _LiveItem extends StatefulWidget {
  const _LiveItem({super.key, required this.child, required this.entering, required this.leaving, required this.onGone, required this.highlight});
  final Widget child;
  final bool entering;
  final bool leaving;
  final bool highlight;
  final VoidCallback onGone;
  @override
  State<_LiveItem> createState() => _LiveItemState();
}

class _LiveItemState extends State<_LiveItem> with TickerProviderStateMixin {
  late final AnimationController _size = AnimationController(vsync: this, duration: SuTokens.slow, value: widget.entering ? 0 : 1);
  late final AnimationController _glow = AnimationController(vsync: this, duration: SuTokens.highlight, value: 1);

  @override
  void initState() {
    super.initState();
    if (widget.entering) {
      _size.forward();
      if (widget.highlight) _glow.forward(from: 0);
    }
  }

  @override
  void didUpdateWidget(_LiveItem old) {
    super.didUpdateWidget(old);
    if (widget.leaving && !old.leaving) {
      _size.reverse().whenComplete(widget.onGone);
    } else if (!widget.leaving && old.leaving) {
      _size.forward();
    }
  }

  @override
  void dispose() {
    _size.dispose();
    _glow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (SuMotion.reduced(context)) {
      if (widget.leaving) WidgetsBinding.instance.addPostFrameCallback((_) => widget.onGone());
      return widget.leaving ? const SizedBox.shrink() : widget.child;
    }
    final curve = CurvedAnimation(parent: _size, curve: SuMotion.easeOut);
    return SizeTransition(
      sizeFactor: curve,
      axisAlignment: -1,
      child: FadeTransition(
        opacity: curve,
        child: AnimatedBuilder(
          animation: _glow,
          child: widget.child,
          builder: (_, child) => _glow.value >= 1
              ? child!
              : DecoratedBox(
                  decoration: BoxDecoration(color: Color.lerp(SuColors.lime.withValues(alpha: 0.55), SuColors.lime.withValues(alpha: 0), Curves.easeIn.transform(_glow.value)), borderRadius: BorderRadius.circular(18)),
                  child: child,
                ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Glisser pour agir
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Glisser une ligne pour une action EXISTANTE (marquer lu, terminer…) : fond coloré qui se
/// révèle, `select()` haptique au franchissement du seuil, l'action s'exécute au relâché. La
/// ligne revient en place (la liste se met à jour d'elle-même). Sens de lecture respecté.
class SuSwipeAction extends StatefulWidget {
  const SuSwipeAction({super.key, required this.child, required this.onAction, required this.icon, required this.label, this.color = SuColors.brand, this.enabled = true});
  final Widget child;
  final Future<void> Function() onAction;
  final IconData icon;
  final String label;
  final Color color;
  final bool enabled;
  @override
  State<SuSwipeAction> createState() => _SuSwipeActionState();
}

class _SuSwipeActionState extends State<SuSwipeAction> {
  bool _past = false;
  static const double _threshold = 0.32;

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled || !Feel.alive) return widget.child;
    return Dismissible(
      key: ObjectKey(widget.child.key ?? widget.label),
      direction: DismissDirection.endToStart,
      dismissThresholds: const {DismissDirection.endToStart: _threshold},
      onUpdate: (d) {
        final past = d.progress >= _threshold;
        if (past != _past) {
          _past = past;
          if (past) Haptics.select();
        }
      },
      confirmDismiss: (_) async {
        await widget.onAction();
        _past = false;
        return false;
      },
      background: const SizedBox.shrink(),
      secondaryBackground: Container(
        decoration: BoxDecoration(color: widget.color, borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsetsDirectional.only(end: 22),
        alignment: AlignmentDirectional.centerEnd,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            const SizedBox(width: 8),
            Icon(widget.icon, color: Colors.white),
          ],
        ),
      ),
      child: widget.child,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Feuilles
// ─────────────────────────────────────────────────────────────────────────────────────────────

/// Feuille du bas générique (remplace showModalBottomSheet) : montée douce, fond assombri,
/// poignée, glisser vers le bas pour fermer.
Future<T?> showSuSheet<T>(BuildContext context, {required WidgetBuilder builder, bool isScrollControlled = true, bool useSafeArea = true, bool showDragHandle = true, Color? backgroundColor}) {
  return showModalBottomSheet<T>(
    useRootNavigator: true,
    context: context,
    sheetAnimationStyle: SuMotion.sheet,
    isScrollControlled: isScrollControlled,
    useSafeArea: useSafeArea,
    showDragHandle: showDragHandle,
    backgroundColor: backgroundColor,
    builder: builder,
  );
}

/// Dialogue vivant (remplace showDialog) : entrée en ressort (léger zoom), fond assombri,
/// sortie vive. Fondu simple en « animations réduites ».
Future<T?> showSuDialog<T>(BuildContext context, {required WidgetBuilder builder, bool barrierDismissible = true}) {
  final reduced = SuMotion.reduced(context);
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: const Color(0x73121212),
    transitionDuration: reduced ? SuTokens.fast : SuTokens.slow,
    pageBuilder: (ctx, _, __) => builder(ctx),
    transitionBuilder: (ctx, a, _, child) {
      final fade = CurvedAnimation(parent: a, curve: SuMotion.easeOut, reverseCurve: SuMotion.easeIn);
      if (reduced || !Feel.alive) return FadeTransition(opacity: fade, child: child);
      return FadeTransition(
        opacity: fade,
        child: ScaleTransition(scale: Tween(begin: 0.92, end: 1.0).animate(CurvedAnimation(parent: a, curve: SuMotion.spring, reverseCurve: SuMotion.easeIn)), child: child),
      );
    },
  );
}
