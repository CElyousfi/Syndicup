import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../feel/feel.dart';
import '../i18n/i18n.dart';
import '../theme/motion.dart';
import '../theme/tokens.dart';
import 'alive.dart';
import 'brand.dart';
import 'motion.dart';
import 'states.dart';

/// Ambiance « Alive » (phase 3) — l'application respire sans réclamer l'attention :
/// salutation selon l'heure, dérive très lente du héros, parallaxe légère, bandeau de connexion
/// calme, état « en attente → synchronisé », passage de relais du lancement. Toute l'ambiance
/// s'éteint en mode lite et en « animations réduites » (`Feel.ambient`).

/// Salutation du tableau de bord selon l'heure locale (FR/AR), révélée mot par mot.
String greetingFor(BuildContext context, DateTime now) {
  final a = context.dict.alive;
  final h = now.hour;
  if (h >= 5 && h < 12) return a.bonjour;
  if (h >= 12 && h < 18) return a.bonApresMidi;
  if (h >= 18 && h < 22) return a.bonsoir;
  return a.bonneNuit;
}

class SuGreeting extends StatelessWidget {
  const SuGreeting({super.key, this.name, this.style, this.now});
  final String? name;
  final TextStyle? style;
  final DateTime? now;
  @override
  Widget build(BuildContext context) {
    final g = greetingFor(context, now ?? DateTime.now());
    final text = name == null || name!.isEmpty ? g : '$g $name';
    final s = style ?? Theme.of(context).textTheme.displaySmall;
    if (!Feel.alive) return Text(text, style: s);
    return SuRevealText(text, style: s, boldFrom: name == null ? null : g.split(' ').length);
  }
}

/// Dérive de dégradé presque imperceptible sur le héros du tableau de bord (≈ 20 s par cycle).
/// Coupée hors ambiance ; le ticker s'arrête quand la route n'est pas visible (TickerMode).
class SuHeroDrift extends StatefulWidget {
  const SuHeroDrift({super.key, required this.child, this.radius = 28});
  final Widget child;
  final double radius;
  @override
  State<SuHeroDrift> createState() => _SuHeroDriftState();
}

class _SuHeroDriftState extends State<SuHeroDrift> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 20));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (Feel.ambient(context)) {
      if (!_c.isAnimating) _c.repeat(reverse: true);
    } else {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!Feel.ambient(context)) return widget.child;
    return Stack(
      children: [
        widget.child,
        Positioned.fill(
          child: IgnorePointer(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _c,
                builder: (_, __) {
                  final t = Curves.easeInOut.transform(_c.value);
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(widget.radius),
                      gradient: RadialGradient(
                        center: Alignment(-0.8 + 1.6 * t, -0.6 + 0.5 * math.sin(t * math.pi)),
                        radius: 1.1,
                        colors: [SuColors.lime.withValues(alpha: 0.16), SuColors.lime.withValues(alpha: 0)],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Parallaxe légère d'une image de héros : l'image glisse plus lentement que la page
/// (≤ 10 px), uniquement en ambiance. Le parent doit découper (ClipRRect).
class SuParallax extends StatefulWidget {
  const SuParallax({super.key, required this.child, this.factor = 0.12, this.max = 10});
  final Widget child;
  final double factor;
  final double max;
  @override
  State<SuParallax> createState() => _SuParallaxState();
}

class _SuParallaxState extends State<SuParallax> {
  ScrollPosition? _pos;
  double _dy = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _pos?.removeListener(_onScroll);
    _pos = Feel.ambient(context) ? Scrollable.maybeOf(context)?.position : null;
    _pos?.addListener(_onScroll);
  }

  void _onScroll() {
    final p = _pos;
    if (p == null || !mounted) return;
    final dy = (p.pixels * widget.factor).clamp(0.0, widget.max);
    if ((dy - _dy).abs() > 0.5) setState(() => _dy = dy);
  }

  @override
  void dispose() {
    _pos?.removeListener(_onScroll);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_pos == null) return widget.child;
    // Agrandie juste assez pour que le glissement ne découvre jamais le bord (bandeaux ≥ 120 px).
    return Transform.translate(offset: Offset(0, _dy), child: Transform.scale(scale: 1 + 2.2 * widget.max / 120, child: widget.child));
  }
}

/// Bandeau d'état calme (hors ligne / connexion rétablie) : se déplie en douceur, jamais d'un
/// coup ; `message == null` le replie.
class SuStatusBanner extends StatelessWidget {
  const SuStatusBanner({super.key, required this.message, this.tone = BannerTone.warn, this.icon, this.topInset = 0});
  final String? message;

  /// Zone sûre du haut (encoche) — incluse DANS le bandeau, donc nulle quand il est replié.
  final double topInset;
  final BannerTone tone;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      BannerTone.ok => (SuColors.okTint, SuColors.ok),
      BannerTone.danger => (SuColors.dangerTint, SuColors.danger),
      _ => (SuColors.warnTint, SuColors.warn),
    };
    final m = message;
    final body = m == null
        ? const SizedBox(width: double.infinity, key: ValueKey('none'))
        : Container(
            key: ValueKey(m),
            width: double.infinity,
            color: bg,
            padding: EdgeInsets.fromLTRB(16, 8 + topInset, 16, 8),
            child: Row(
              children: [
                Icon(icon ?? (tone == BannerTone.ok ? Icons.wifi_rounded : Icons.wifi_off_rounded), size: 18, color: fg),
                const SizedBox(width: 10),
                Expanded(child: Text(m, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13.5))),
              ],
            ),
          );
    return Semantics(
      liveRegion: true,
      child: AnimatedSize(
        duration: SuMotion.of(context, SuTokens.base),
        curve: SuMotion.easeOut,
        alignment: Alignment.topCenter,
        child: AnimatedSwitcher(duration: SuMotion.of(context, SuTokens.fast), child: body),
      ),
    );
  }
}

/// État d'une action mise en file hors ligne : « en attente » (horloge discrète) puis coche
/// tracée quand elle est synchronisée — la coche s'efface d'elle-même ensuite.
class SuSyncState extends StatefulWidget {
  const SuSyncState({super.key, required this.pending, this.size = 18, this.pendingLabel, this.doneLabel, this.forceDone = false});
  final bool pending;

  /// Affiche directement la coche « synchronisé » (utilisé par SuQueueSyncFlash).
  final bool forceDone;
  final double size;
  final String? pendingLabel;
  final String? doneLabel;
  @override
  State<SuSyncState> createState() => _SuSyncStateState();
}

class _SuSyncStateState extends State<SuSyncState> {
  late bool _justSynced = widget.forceDone;

  @override
  void didUpdateWidget(SuSyncState old) {
    super.didUpdateWidget(old);
    if (old.pending && !widget.pending) {
      setState(() => _justSynced = true);
      Haptics.select();
      Future<void>.delayed(const Duration(milliseconds: 1600), () {
        if (mounted) setState(() => _justSynced = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.dict.alive;
    final Widget child;
    if (widget.pending) {
      child = Row(key: const ValueKey('p'), mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.schedule_rounded, size: widget.size, color: SuColors.warn),
        const SizedBox(width: 4),
        Text(widget.pendingLabel ?? a.enAttente, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SuColors.warn)),
      ]);
    } else if (_justSynced) {
      child = Row(key: const ValueKey('d'), mainAxisSize: MainAxisSize.min, children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: SuMotion.reduced(context) ? 1 : 0, end: 1),
          duration: SuTokens.slow,
          builder: (_, p, __) => CustomPaint(size: Size.square(widget.size), painter: CheckPainter(progress: p, color: SuColors.ok, stroke: 2.4)),
        ),
        const SizedBox(width: 4),
        Text(widget.doneLabel ?? a.synchronise, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SuColors.ok)),
      ]);
    } else {
      child = const SizedBox.shrink(key: ValueKey('n'));
    }
    return AnimatedSwitcher(duration: SuMotion.of(context, SuTokens.fast), child: child);
  }
}

/// Passage de relais du lancement : le logo du démarrage reste à l'écran une fraction de seconde
/// au-dessus du premier écran, puis s'efface en remontant vers l'en-tête — pas de coupure
/// sèche entre l'écran de démarrage et le tableau de bord (la route reste sans transition, voir
/// la note NoTransitionPage dans le routeur).
class LaunchHandoff {
  LaunchHandoff._();
  static bool _pending = false;

  /// Appelé par l'écran de démarrage quand il s'affiche.
  static void arm() => _pending = true;

  /// Appelé par la coque à son premier affichage.
  static void play(BuildContext context) {
    if (!_pending) return;
    _pending = false;
    if (!Feel.alive) return;
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    late OverlayEntry e;
    e = OverlayEntry(builder: (_) => _Handoff(onDone: () => e.remove()));
    overlay.insert(e);
  }
}

class _Handoff extends StatefulWidget {
  const _Handoff({required this.onDone});
  final VoidCallback onDone;
  @override
  State<_Handoff> createState() => _HandoffState();
}

class _HandoffState extends State<_Handoff> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 650));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (SuMotion.reduced(context)) {
        widget.onDone();
        return;
      }
      _c.forward().whenComplete(widget.onDone);
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final pad = MediaQuery.paddingOf(context);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    // Destination : l'avatar de l'en-tête (début de ligne, sous l'encoche).
    final target = Offset(rtl ? size.width - 40 : 40, pad.top + 36);
    final start = Offset(size.width / 2, size.height / 2);
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) {
          final t = SuTokens.easeOut.transform(_c.value);
          final bg = 1 - Curves.easeOut.transform((_c.value / 0.55).clamp(0.0, 1.0));
          final pos = Offset.lerp(start, target, t)!;
          return Stack(
            children: [
              Positioned.fill(child: ColoredBox(color: SuColors.surface.withValues(alpha: bg))),
              Positioned(
                left: pos.dx - 36,
                top: pos.dy - 36,
                child: Opacity(
                  opacity: (1 - t * 1.1).clamp(0.0, 1.0),
                  child: Transform.scale(scale: 1 - 0.45 * t, child: const BrandTile(size: 72)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Révélation au défilement (première fois seulement) : une carte qui entre dans l'écran APRÈS
/// la fenêtre d'entrée glisse et apparaît une seule fois par écran ; jamais rejouée au retour.
class SuScrollReveal extends StatefulWidget {
  const SuScrollReveal({super.key, required this.child, required this.id});
  final Widget child;

  /// Identité stable dans l'écran (index de section, id d'objet).
  final Object id;
  @override
  State<SuScrollReveal> createState() => _SuScrollRevealState();
}

final Expando<Set<Object>> _revealSeen = Expando<Set<Object>>();

/// Marque [id] comme déjà vu dans l'écran courant (arrivé pendant la cascade d'entrée).
void markScrollSeen(BuildContext context, Object id) {
  final route = ModalRoute.of(context);
  if (route != null) (_revealSeen[route] ??= <Object>{}).add(id);
}

class _SuScrollRevealState extends State<SuScrollReveal> {
  bool _animate = false;
  bool _decided = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    final route = ModalRoute.of(context);
    if (route == null || !Feel.ambient(context)) return;
    final seen = _revealSeen[route] ??= <Object>{};
    _animate = seen.add(widget.id) && !isEntranceWindowOpen(context);
  }

  @override
  Widget build(BuildContext context) {
    if (!_animate) return widget.child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: SuTokens.slow,
      curve: SuMotion.easeOut,
      child: widget.child,
      builder: (_, t, ch) => Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 16 * (1 - t)), child: ch)),
    );
  }
}

/// File hors ligne : quand des actions en attente partent (le compteur BAISSE), une coche
/// « Synchronisé » se trace un instant à cet endroit — l'utilisateur voit son travail arriver.
class SuQueueSyncFlash extends StatefulWidget {
  const SuQueueSyncFlash({super.key, required this.pending});
  final int pending;
  @override
  State<SuQueueSyncFlash> createState() => _SuQueueSyncFlashState();
}

class _SuQueueSyncFlashState extends State<SuQueueSyncFlash> {
  bool _flash = false;

  @override
  void didUpdateWidget(SuQueueSyncFlash old) {
    super.didUpdateWidget(old);
    if (widget.pending < old.pending && Feel.alive) {
      setState(() => _flash = true);
      Haptics.select();
      Future<void>.delayed(const Duration(milliseconds: 1800), () {
        if (mounted) setState(() => _flash = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedSize(
        duration: SuMotion.of(context, SuTokens.base),
        curve: SuMotion.easeOut,
        child: _flash
            ? Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Align(alignment: AlignmentDirectional.centerStart, child: SuSyncState(pending: false, key: ValueKey(widget.pending), forceDone: true)),
              )
            : const SizedBox(width: double.infinity),
      );
}
