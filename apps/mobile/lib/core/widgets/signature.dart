import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../feel/feel.dart';
import '../i18n/i18n.dart';
import '../theme/motion.dart';
import '../theme/tokens.dart';
import 'alive.dart';
import 'brand.dart';

/// Moments signature (docs/ALIVE_GUIDE.md §4) — mouvement + haptique + son, ≤ 1,2 s, passables
/// d'un tap, JAMAIS bloquants : posés dans l'overlay racine au-dessus de l'écran, ils ne
/// retiennent aucune navigation et se retirent seuls. Toujours joués APRÈS la confirmation du
/// serveur (ils n'annoncent jamais un succès à la place de l'API). « Animations réduites » :
/// l'image finale s'affiche directement puis s'efface ; vibration et son restent (réglages).
/// `alive_v1` coupé : aucun moment n'est joué.
class SuSignature {
  SuSignature._();

  static OverlayEntry? _current;

  /// Joue [moment] (un des constructeurs ci-dessous). [hold] : durée totale avant effacement.
  static void play(BuildContext context, Widget Function(Animation<double> t) moment, {Duration hold = SuTokens.signatureMax, VoidCallback? onPeak, Duration peakAt = const Duration(milliseconds: 600)}) {
    if (!Feel.alive) return;
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    _current?.remove();
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _SignatureHost(
        hold: hold,
        peakAt: peakAt,
        onPeak: onPeak,
        builder: moment,
        onDone: () {
          if (_current == entry) _current = null;
          if (entry.mounted) entry.remove();
        },
      ),
    );
    _current = entry;
    overlay.insert(entry);
  }

  // ── 1. Paiement enregistré : le montant vole vers le solde, le solde roule, le reçu est scellé ──
  static void payment(BuildContext context, {required String amount, String? balanceBefore, String? balanceAfter}) {
    final label = context.dict.alive.paiementEnregistre;
    play(context, (t) => _PaymentMoment(t: t, amount: amount, before: balanceBefore, after: balanceAfter, label: label), peakAt: const Duration(milliseconds: 720), onPeak: () {
      Haptics.success();
      Sounds.play(SuSound.success);
    });
  }

  // ── 2. Les 12 annexes générées : 12 documents en cascade serrée, chacun coché, puis le sceau ──
  /// L'UNIQUE appel que fera le module comptable (Décret 2.23.700) quand il existera :
  ///   `SuSignature.annexes(context, titles: [...12 intitulés...]);`
  /// juste après la réponse 2xx de l'API de génération — aucune logique métier ici.
  static void annexes(BuildContext context, {List<String>? titles}) {
    final a = context.dict.alive;
    final names = titles ?? [for (int i = 1; i <= 12; i++) '${a.annexe} $i'];
    play(context, (t) => _AnnexesMoment(t: t, titles: names, seal: a.conforme, caption: a.annexesGenerees), peakAt: const Duration(milliseconds: 820), onPeak: () {
      Haptics.heavy();
      Sounds.play(SuSound.signature);
    });
  }

  // ── 3. Relance / appel de fonds envoyé : le message part, coche « Envoyé » ──
  static void sent(BuildContext context, {String? label}) {
    final l = label ?? context.dict.alive.envoye;
    play(context, (t) => _SentMoment(t: t, label: l), hold: const Duration(milliseconds: 1100), peakAt: const Duration(milliseconds: 420), onPeak: () {
      Haptics.success();
      Sounds.play(SuSound.sent);
    });
  }

  // ── 4. Vote d'AG : le bulletin tombe dans l'urne ──
  static void vote(BuildContext context, {String? label}) {
    final l = label ?? context.dict.alive.voteEnregistre;
    play(context, (t) => _VoteMoment(t: t, label: l), hold: const Duration(milliseconds: 1100), peakAt: const Duration(milliseconds: 520), onPeak: Haptics.success);
  }

  // ── 5. Dépense justifiée : la photo du reçu se pose sur la dépense, badge « Justifiée » ──
  static void justified(BuildContext context, {ImageProvider? receipt, String? title}) {
    final l = context.dict.alive.justifiee;
    play(context, (t) => _JustifiedMoment(t: t, receipt: receipt, title: title, badge: l), peakAt: const Duration(milliseconds: 640), onPeak: () {
      Haptics.success();
      Sounds.play(SuSound.confirm);
    });
  }

  // ── 7. Bienvenue (fin d'onboarding / première connexion) : le logo se trace, une fois ──
  static Future<void> welcomeOnce(BuildContext context, {required String userKey}) async {
    final prefs = await SharedPreferences.getInstance();
    final k = 'alive.welcome.$userKey';
    if (prefs.getBool(k) == true || !context.mounted) return;
    await prefs.setBool(k, true);
    if (!context.mounted) return;
    final l = context.dict.alive.bienvenue;
    play(context, (t) => _WelcomeMoment(t: t, label: l), peakAt: const Duration(milliseconds: 700), onPeak: Haptics.success);
  }

  /// 6. Résidence 100 % à jour : le halo de l'anneau ne brille qu'UNE fois par période.
  /// Renvoie true la première fois pour [periodKey] (ex. 'copro-42:2026-10').
  static Future<bool> oncePerPeriod(String periodKey) async {
    final prefs = await SharedPreferences.getInstance();
    final k = 'alive.once.$periodKey';
    if (prefs.getBool(k) == true) return false;
    await prefs.setBool(k, true);
    return true;
  }
}

class _SignatureHost extends StatefulWidget {
  const _SignatureHost({required this.hold, required this.builder, required this.onDone, required this.peakAt, this.onPeak});
  final Duration hold;
  final Duration peakAt;
  final VoidCallback? onPeak;
  final Widget Function(Animation<double> t) builder;
  final VoidCallback onDone;
  @override
  State<_SignatureHost> createState() => _SignatureHostState();
}

class _SignatureHostState extends State<_SignatureHost> with TickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: widget.hold);
  late final AnimationController _out = AnimationController(vsync: this, duration: SuTokens.base);
  bool _peaked = false;
  bool _reduced = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = SuMotion.reduced(context);
  }

  @override
  void initState() {
    super.initState();
    _t.addListener(() {
      if (!_peaked && _t.value * widget.hold.inMilliseconds >= widget.peakAt.inMilliseconds) _peak();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_reduced) {
        _t.value = 1;
        _peak();
        Future<void>.delayed(const Duration(milliseconds: 900), _dismiss);
      } else {
        _t.forward().whenComplete(_dismiss);
      }
    });
  }

  void _peak() {
    if (_peaked) return;
    _peaked = true;
    widget.onPeak?.call();
  }

  void _dismiss() {
    if (!mounted || _out.isAnimating || _out.value == 1) return;
    _peak();
    _out.forward().whenComplete(widget.onDone);
  }

  @override
  void dispose() {
    _t.dispose();
    _out.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a11y = MediaQuery.of(context).accessibleNavigation;
    return AnimatedBuilder(
      animation: _out,
      builder: (_, child) => Opacity(opacity: 1 - _out.value, child: child),
      child: GestureDetector(
        // Passable d'un tap n'importe où ; ne retient jamais l'interface.
        behavior: HitTestBehavior.opaque,
        onTap: _dismiss,
        child: Semantics(
          // Lecteurs d'écran : le moment ne s'annonce pas (le succès l'est déjà par l'écran).
          excludeSemantics: true,
          child: ColoredBox(
            color: SuColors.ink.withValues(alpha: a11y ? 0.2 : 0.38),
            child: SafeArea(child: Center(child: widget.builder(_t))),
          ),
        ),
      ),
    );
  }
}

/// Fraction locale d'une animation globale [t] entre [a] et [b] (0..1), courbée.
double _seg(Animation<double> t, double a, double b, [Curve c = SuTokens.easeOut]) => c.transform(((t.value - a) / (b - a)).clamp(0.0, 1.0));

/// Sceau circulaire tamponné (« CONFORME », « PAYÉ ») : chute en zoom + légère rotation.
class _Seal extends StatelessWidget {
  const _Seal({required this.p, required this.label, this.size = 112});
  final double p;
  final String label;
  final double size;
  @override
  Widget build(BuildContext context) {
    if (p <= 0) return SizedBox.square(dimension: size);
    final s = 1.6 - 0.6 * SuTokens.spring.transform(p);
    return Opacity(
      opacity: p.clamp(0.0, 1.0),
      child: Transform.rotate(
        angle: -0.14 * (1 - p) - 0.08,
        child: Transform.scale(
          scale: s,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(shape: BoxShape.circle, color: SuColors.brand, border: Border.all(color: SuColors.lime, width: 4)),
            alignment: Alignment.center,
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: FittedBox(child: Text(SuType.posterText(context, label), style: SuType.poster(context, 22, color: SuColors.lime))),
            ),
          ),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child, this.width = 280});
  final Widget child;
  final double width;
  @override
  Widget build(BuildContext context) => Container(
        width: width,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(24), boxShadow: SuShadows.pop),
        child: child,
      );
}

class _PaymentMoment extends StatelessWidget {
  const _PaymentMoment({required this.t, required this.amount, required this.label, this.before, this.after});
  final Animation<double> t;
  final String amount;
  final String label;
  final String? before;
  final String? after;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final rise = _seg(t, 0, 0.3);
        final fly = _seg(t, 0.25, 0.55);
        final stamp = _seg(t, 0.55, 0.75, Curves.linear);
        final showAfter = fly >= 1 && after != null;
        return Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            Transform.translate(
              offset: Offset(0, 40 * (1 - rise)),
              child: Opacity(
                opacity: rise,
                child: _Card(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(label, style: tt.titleMedium, textAlign: TextAlign.center),
                      const SizedBox(height: 18),
                      // Solde qui roule ; sans solde, le montant « atterrit » dans le reçu.
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(color: SuColors.tile, borderRadius: BorderRadius.circular(14)),
                        child: Center(
                          child: before != null || after != null
                              ? AnimatedAmount(showAfter ? after : (before ?? after), style: tt.titleLarge)
                              : Opacity(opacity: _seg(t, 0.5, 0.6), child: AnimatedAmount(amount, style: tt.titleLarge)),
                        ),
                      ),
                      const SizedBox(height: 60),
                    ],
                  ),
                ),
              ),
            ),
            // Le montant part du bas de la carte et « tombe » dans le solde.
            if (fly < 1)
              Transform.translate(
                offset: Offset(0, 46 - 54 * fly),
                child: Transform.scale(
                  scale: 1 - 0.3 * fly,
                  child: Opacity(
                    opacity: rise * (1 - _seg(t, 0.48, 0.55)),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(color: SuColors.cta, borderRadius: BorderRadius.circular(999)),
                      child: AnimatedAmount(amount, style: tt.titleMedium?.copyWith(color: SuColors.onCta)),
                    ),
                  ),
                ),
              ),
            PositionedDirectional(end: -18, top: -34, child: _Seal(p: stamp, label: '✓', size: 76)),
          ],
        );
      },
    );
  }
}

class _AnnexesMoment extends StatelessWidget {
  const _AnnexesMoment({required this.t, required this.titles, required this.seal, required this.caption, this.onLight = false});
  final bool onLight;
  final Animation<double> t;
  final List<String> titles;
  final String seal;
  final String caption;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final n = titles.length;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final close = _seg(t, 0.58, 0.68);
        final stamp = _seg(t, 0.62, 0.8, Curves.linear);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                // Le « coffre » : la grille se resserre légèrement quand il se ferme.
                Transform.scale(
                  scale: 1 - 0.06 * close,
                  child: _Card(
                    width: 300,
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      alignment: WrapAlignment.center,
                      children: [
                        for (int i = 0; i < n; i++)
                          () {
                            // Cascade serrée : 12 documents en ~0,5 s, chacun coché.
                            final start = 0.04 + i * 0.036;
                            final p = _seg(t, start, start + 0.12, SuTokens.spring);
                            final tick = _seg(t, start + 0.08, start + 0.18);
                            return Opacity(
                              opacity: p.clamp(0.0, 1.0),
                              child: Transform.scale(
                                scale: 0.6 + 0.4 * p,
                                child: Container(
                                  width: 76,
                                  height: 44,
                                  padding: const EdgeInsets.symmetric(horizontal: 6),
                                  decoration: BoxDecoration(color: SuColors.tile, borderRadius: BorderRadius.circular(10)),
                                  child: Row(
                                    children: [
                                      SizedBox.square(dimension: 16, child: CustomPaint(painter: CheckPainter(progress: tick, color: SuColors.ok, stroke: 2.2))),
                                      const SizedBox(width: 4),
                                      Expanded(child: Text(titles[i], maxLines: 2, overflow: TextOverflow.ellipsis, style: tt.labelSmall?.copyWith(fontSize: 9.5, height: 1.1))),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }(),
                      ],
                    ),
                  ),
                ),
                _Seal(p: stamp, label: seal),
              ],
            ),
            const SizedBox(height: 16),
            Opacity(opacity: stamp, child: Text(caption, style: tt.titleMedium?.copyWith(color: onLight ? SuColors.ink : Colors.white))),
          ],
        );
      },
    );
  }
}

class _SentMoment extends StatelessWidget {
  const _SentMoment({required this.t, required this.label, this.onLight = false});
  final bool onLight;
  final Animation<double> t;
  final String label;
  @override
  Widget build(BuildContext context) {
    final sign = SuMotion.sign(context);
    final tt = Theme.of(context).textTheme;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final appear = _seg(t, 0, 0.18);
        final go = _seg(t, 0.2, 0.42, Curves.easeIn);
        final check = _seg(t, 0.4, 0.62, SuTokens.spring);
        final draw = _seg(t, 0.46, 0.66);
        return SizedBox(
          width: 280,
          height: 160,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Le message s'envole vers la fin de ligne (miroir en arabe).
              Transform.translate(
                offset: Offset(sign * 260 * go, -50 * go),
                child: Transform.rotate(
                  angle: sign * -0.25 * go,
                  child: Opacity(
                    opacity: appear * (1 - go),
                    child: Container(
                      width: 150,
                      height: 96,
                      decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(16), boxShadow: SuShadows.pop),
                      child: const Icon(Icons.mail_rounded, size: 46, color: SuColors.brand),
                    ),
                  ),
                ),
              ),
              Opacity(
                opacity: check.clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: 0.5 + 0.5 * check,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 76,
                        height: 76,
                        decoration: const BoxDecoration(color: SuColors.cta, shape: BoxShape.circle),
                        child: CustomPaint(painter: CheckPainter(progress: draw, color: SuColors.ink, stroke: 5)),
                      ),
                      const SizedBox(height: 10),
                      Text(label, style: tt.titleMedium?.copyWith(color: onLight ? SuColors.ink : Colors.white)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _VoteMoment extends StatelessWidget {
  const _VoteMoment({required this.t, required this.label});
  final Animation<double> t;
  final String label;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final appear = _seg(t, 0, 0.2);
        final drop = _seg(t, 0.2, 0.48, Curves.easeIn);
        final settle = _seg(t, 0.46, 0.62, SuTokens.spring);
        return SizedBox(
          width: 220,
          height: 220,
          child: Stack(
            alignment: Alignment.bottomCenter,
            children: [
              // Bulletin : descend dans la fente et disparaît derrière l'urne.
              Positioned(
                bottom: 70 + 90 * (1 - drop),
                child: Opacity(
                  opacity: appear,
                  child: Container(
                    width: 90,
                    height: 110,
                    decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(10), boxShadow: SuShadows.pop),
                    child: const Icon(Icons.how_to_vote_rounded, color: SuColors.brand, size: 40),
                  ),
                ),
              ),
              // Urne (au premier plan : masque le bulletin qui entre).
              Transform.scale(
                scale: 1 + 0.06 * math.sin(settle * math.pi),
                child: Container(
                  width: 180,
                  height: 96,
                  decoration: BoxDecoration(color: SuColors.brand, borderRadius: BorderRadius.circular(18)),
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 110, height: 8, decoration: BoxDecoration(color: SuColors.ink.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(9))),
                      const SizedBox(height: 14),
                      Opacity(opacity: settle.clamp(0.0, 1.0), child: Text(label, style: tt.labelLarge?.copyWith(color: SuColors.lime, fontWeight: FontWeight.w700))),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _JustifiedMoment extends StatelessWidget {
  const _JustifiedMoment({required this.t, required this.badge, this.receipt, this.title});
  final Animation<double> t;
  final ImageProvider? receipt;
  final String? title;
  final String badge;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final appear = _seg(t, 0, 0.2);
        final snap = _seg(t, 0.2, 0.5, SuTokens.spring);
        final badgeP = _seg(t, 0.5, 0.66, SuTokens.spring);
        return Opacity(
          opacity: appear,
          child: _Card(
            child: Row(
              children: [
                // La photo du reçu arrive de haut, légèrement tournée, et se « clipse » en place.
                Transform.translate(
                  offset: Offset(0, -80 * (1 - snap)),
                  child: Transform.rotate(
                    angle: -0.2 * (1 - snap),
                    child: Container(
                      width: 64,
                      height: 80,
                      decoration: BoxDecoration(
                        color: SuColors.tile,
                        borderRadius: BorderRadius.circular(10),
                        image: receipt == null ? null : DecorationImage(image: receipt!, fit: BoxFit.cover),
                        boxShadow: snap < 1 ? SuShadows.pop : const [],
                      ),
                      child: receipt == null ? const Icon(Icons.receipt_long_rounded, color: SuColors.brand, size: 32) : null,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (title != null) Text(title!, style: tt.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 8),
                      Transform.scale(
                        alignment: AlignmentDirectional.centerStart,
                        scale: badgeP,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                          decoration: BoxDecoration(color: SuColors.ok, borderRadius: BorderRadius.circular(999)),
                          child: Text(badge, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12.5)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _WelcomeMoment extends StatelessWidget {
  const _WelcomeMoment({required this.t, required this.label, this.onLight = false});
  final bool onLight;
  final Animation<double> t;
  final String label;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return AnimatedBuilder(
      animation: t,
      builder: (context, _) {
        final mark = _seg(t, 0, 0.4, SuTokens.spring);
        final text = _seg(t, 0.35, 0.6);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Transform.scale(scale: 0.5 + 0.5 * mark, child: Opacity(opacity: mark.clamp(0.0, 1.0), child: const BrandTile(size: 96))),
            const SizedBox(height: 18),
            Transform.translate(
              offset: Offset(0, 12 * (1 - text)),
              child: Opacity(opacity: text, child: Text(label, style: tt.headlineMedium?.copyWith(color: onLight ? SuColors.ink : Colors.white), textAlign: TextAlign.center)),
            ),
          ],
        );
      },
    );
  }
}

/// Moment signature joué DANS un écran (ex. l'écran de succès) au lieu d'un calque : la
/// chorégraphie tourne une fois (≤ 1,2 s) puis s'arrête sur son image finale.
enum SuMomentKind { payment, sent, vote, justified, annexes, welcome }

class SuMomentView extends StatefulWidget {
  const SuMomentView({super.key, required this.kind, this.amount, this.onPeak});
  final SuMomentKind kind;
  final String? amount;
  final VoidCallback? onPeak;
  @override
  State<SuMomentView> createState() => _SuMomentViewState();
}

class _SuMomentViewState extends State<SuMomentView> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: SuTokens.signatureMax);
  bool _peaked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_t.isAnimating || _t.value > 0) return;
    if (SuMotion.reduced(context)) {
      _t.value = 1;
      _peak();
    } else {
      _t.addListener(() {
        if (_t.value >= 0.55) _peak();
      });
      _t.forward();
    }
  }

  void _peak() {
    if (_peaked) return;
    _peaked = true;
    widget.onPeak?.call();
  }

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.dict.alive;
    return switch (widget.kind) {
      SuMomentKind.payment => _PaymentMoment(t: _t, amount: widget.amount ?? '', label: a.paiementEnregistre),
      SuMomentKind.sent => _SentMoment(t: _t, label: a.envoye, onLight: true),
      SuMomentKind.vote => _VoteMoment(t: _t, label: a.voteEnregistre),
      SuMomentKind.justified => _JustifiedMoment(t: _t, badge: a.justifiee),
      SuMomentKind.annexes => _AnnexesMoment(t: _t, titles: [for (int i = 1; i <= 12; i++) '${a.annexe} $i'], seal: a.conforme, caption: a.annexesGenerees, onLight: true),
      SuMomentKind.welcome => _WelcomeMoment(t: _t, label: a.bienvenue, onLight: true),
    };
  }
}
