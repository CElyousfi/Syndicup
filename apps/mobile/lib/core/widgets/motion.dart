import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../theme/motion.dart';
import '../theme/tokens.dart';

/// Fenêtre d'entrée : les animations d'apparition (cascade, odomètre) ne jouent que pendant
/// les premiers instants d'un écran. Un élément reconstruit plus tard (défilement retour,
/// rafraîchissement, données live) apparaît directement — jamais de « re-cascade ».
class _EntranceWindow {
  static final Expando<DateTime> _start = Expando<DateTime>();
  static const Duration window = Duration(milliseconds: 1400);

  static bool open(BuildContext context) {
    if (SuMotion.reduced(context)) return false;
    final route = ModalRoute.of(context);
    if (route == null) return true;
    final now = DateTime.now();
    final t = _start[route] ??= now;
    return now.difference(t) < window;
  }
}

/// Apparition en cascade : fondu + léger soulèvement, décalé selon `index` (plafonné).
class SuEnter extends StatelessWidget {
  const SuEnter({super.key, required this.child, this.index = 0, this.offset = 0.06, this.delay = Duration.zero});
  final Widget child;
  final int index;
  final double offset;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    if (!_EntranceWindow.open(context)) return child;
    final d = delay + SuMotion.stagger * math.min(index, SuMotion.maxStagger);
    return child
        .animate(delay: d)
        .fadeIn(duration: 380.ms, curve: SuMotion.easeOut)
        .slideY(begin: offset, end: 0, duration: 460.ms, curve: SuMotion.easeOut);
  }
}

/// Colonne dont les enfants arrivent l'un après l'autre.
class SuStagger extends StatelessWidget {
  const SuStagger({super.key, required this.children, this.crossAxisAlignment = CrossAxisAlignment.stretch, this.delay = Duration.zero});
  final List<Widget> children;
  final CrossAxisAlignment crossAxisAlignment;
  final Duration delay;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: crossAxisAlignment,
        mainAxisSize: MainAxisSize.min,
        children: [for (int i = 0; i < children.length; i++) SuEnter(index: i, delay: delay, child: children[i])],
      );
}

/// Retour tactile « pressé » : l'élément s'enfonce légèrement sous le doigt puis rebondit.
/// Écoute les pointeurs sans entrer dans l'arène des gestes (l'InkWell / le bouton enfant
/// reçoit toujours le tap) ; un défilement annule l'effet.
class SuPressable extends StatefulWidget {
  const SuPressable({super.key, required this.child, this.scale = 0.97, this.enabled = true});
  final Widget child;
  final double scale;
  final bool enabled;
  @override
  State<SuPressable> createState() => _SuPressableState();
}

class _SuPressableState extends State<SuPressable> {
  bool _down = false;
  Offset? _origin;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return Listener(
      onPointerDown: (e) {
        _origin = e.position;
        _set(true);
      },
      onPointerMove: (e) {
        if (_origin != null && (e.position - _origin!).distance > 10) _set(false);
      },
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: SuMotion.of(context, _down ? SuMotion.fast : const Duration(milliseconds: 380)),
        curve: _down ? SuMotion.easeOut : SuMotion.spring,
        child: widget.child,
      ),
    );
  }
}

/// Odomètre : chaque chiffre d'une valeur DÉJÀ FORMATÉE défile de 0 jusqu'à sa valeur, puis
/// d'une valeur à l'autre quand la donnée change. Aucun calcul : on anime les caractères de la
/// chaîne produite par le formateur (règle « argent hors float ») — la dernière image est le
/// texte d'origine. Les jetons numériques sont toujours lus de gauche à droite.
class AnimatedDigits extends StatelessWidget {
  const AnimatedDigits(this.text, {super.key, this.style});
  final String text;
  final TextStyle? style;

  static final RegExp _digit = RegExp(r'\d');

  @override
  Widget build(BuildContext context) {
    final base = (style ?? DefaultTextStyle.of(context).style).copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
    if (!_digit.hasMatch(text)) return Text(text, style: base, maxLines: 1);
    final animate = _EntranceWindow.open(context);
    final reduced = SuMotion.reduced(context);
    int pos = 0;
    final tokens = text.split(' ');
    final children = <Widget>[];
    for (int t = 0; t < tokens.length; t++) {
      final tok = tokens[t];
      if (t > 0) children.add(Text(' ', style: base));
      if (!_digit.hasMatch(tok)) {
        children.add(Text(tok, style: base));
        continue;
      }
      children.add(Row(
        mainAxisSize: MainAxisSize.min,
        textDirection: TextDirection.ltr,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          for (final ch in tok.characters)
            if (_digit.hasMatch(ch))
              _DigitRoll(digit: int.parse(ch), style: base, position: pos++, fromZero: animate, reduced: reduced)
            else
              Text(ch, style: base),
        ],
      ));
    }
    return Semantics(
      label: text,
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: children,
      ),
    );
  }
}

class _DigitRoll extends StatelessWidget {
  const _DigitRoll({required this.digit, required this.style, required this.position, required this.fromZero, required this.reduced});
  final int digit;
  final TextStyle style;
  final int position;
  final bool fromZero;
  final bool reduced;

  @override
  Widget build(BuildContext context) {
    final target = digit.toDouble();
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: fromZero ? 0 : target, end: target),
      duration: reduced ? Duration.zero : Duration(milliseconds: 1000 + position * 90),
      curve: SuMotion.easeOut,
      builder: (context, v, _) => ClipRect(
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            // Chiffre fantôme : fixe la taille et la ligne de base.
            Opacity(opacity: 0, child: Text('$digit', style: style)),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: FractionalTranslation(
                translation: Offset(0, -v / 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [for (int i = 0; i < 10; i++) Text('$i', style: style, textAlign: TextAlign.center)],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Orbe de chargement « vivant » : trois pastilles sauge qui respirent en vague —
/// remplace le spinner circulaire sur les écrans d'attente (démarrage, séance d'AG…).
class LoadingOrb extends StatelessWidget {
  const LoadingOrb({super.key, this.size = 12, this.color = SuColors.action});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final reduced = SuMotion.reduced(context);
    return Semantics(
      label: MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (int i = 0; i < 3; i++)
            Padding(
              padding: EdgeInsets.symmetric(horizontal: size * 0.3),
              child: () {
                final dot = Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
                if (reduced) return dot;
                return dot
                    .animate(onPlay: (c) => c.repeat(reverse: true), delay: (i * 160).ms)
                    .scaleXY(begin: 0.55, end: 1, duration: 620.ms, curve: Curves.easeInOut)
                    .fade(begin: 0.35, end: 1, duration: 620.ms, curve: Curves.easeInOut);
              }(),
            ),
        ],
      ),
    );
  }
}

/// Titre révélé mot par mot (flou → net, léger soulèvement) — jamais lettre par lettre, pour
/// que l'arabe garde ses liaisons. `boldFrom` : index du premier mot en gras (prénom).
class SuRevealText extends StatelessWidget {
  const SuRevealText(this.text, {super.key, this.style, this.boldFrom, this.delay = const Duration(milliseconds: 80)});
  final String text;
  final TextStyle? style;
  final int? boldFrom;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final base = style ?? DefaultTextStyle.of(context).style;
    final words = text.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final animate = _EntranceWindow.open(context);
    final rich = Text.rich(
      TextSpan(children: [
        for (int i = 0; i < words.length; i++) TextSpan(text: '${i > 0 ? ' ' : ''}${words[i]}', style: boldFrom != null && i >= boldFrom! ? const TextStyle(fontWeight: FontWeight.w700) : null),
      ]),
      style: base,
    );
    if (!animate) return rich;
    return Semantics(
      label: text,
      excludeSemantics: true,
      child: Wrap(
        spacing: (base.fontSize ?? 14) * 0.26,
        children: [
          for (int i = 0; i < words.length; i++)
            Text(words[i], style: boldFrom != null && i >= boldFrom! ? base.copyWith(fontWeight: FontWeight.w700) : base)
                .animate(delay: delay + Duration(milliseconds: 60 * i))
                .fadeIn(duration: 520.ms, curve: SuMotion.easeOut)
                .blurXY(begin: 6, end: 0, duration: 560.ms, curve: SuMotion.easeOut)
                .slideY(begin: 0.3, end: 0, duration: 560.ms, curve: SuMotion.easeOut),
        ],
      ),
    );
  }
}

/// Mémoire de défilement des écrans racines d'onglet : changer d'onglet puis revenir ramène
/// exactement où l'on était (la coque garde le seau ; chaque écran le pose sur sa liste).
class TabScrollMemory extends InheritedWidget {
  const TabScrollMemory({super.key, required this.bucket, required super.child});
  final PageStorageBucket bucket;

  /// Écrans racines (barre d'onglets / menu « Plus »).
  static const Set<String> roots = {
    '/tableau-de-bord', '/finances/appels-de-fonds', '/incidents', '/lots', '/affichage', '/finances/comptabilite',
    '/reservations', '/visites', '/location-courte-duree', '/documents', '/admin', '/cabinet', '/rapports', '/taches',
  };

  static PageStorageBucket? _of(BuildContext context) => context.getInheritedWidgetOfExactType<TabScrollMemory>()?.bucket;

  @override
  bool updateShouldNotify(TabScrollMemory oldWidget) => bucket != oldWidget.bucket;
}

/// Liste défilante qui retrouve sa position quand on revient sur l'onglet [path].
/// Hors écran racine (ou hors coque), rend la liste telle quelle.
Widget rememberTabScroll(BuildContext context, String? path, Widget Function(Key? key) list) {
  final bucket = TabScrollMemory._of(context);
  if (bucket == null || path == null || !TabScrollMemory.roots.contains(path)) return list(null);
  return PageStorage(bucket: bucket, child: list(PageStorageKey<String>('tab-scroll:$path')));
}
