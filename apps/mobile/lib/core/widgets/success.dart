import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../feel/feel.dart';
import '../i18n/mobile_dict.dart';
import '../theme/motion.dart';
import '../theme/tokens.dart';
import 'alive.dart';
import 'cards.dart';
import 'illustration.dart';

/// Écran de succès plein écran — moment Wise qui clôt une action importante (paiement déclaré,
/// incident signalé, réservation, invitation, visiteur, vote…) : illustration (ou disque sauge
/// dont la coche se trace), titre-affiche en capitales, explication, pill « Terminé ».
/// Couvre la barre d'onglets (navigateur racine). Se ferme d'un geste retour comme d'un tap.
/// [secondaryLabel] / [onSecondary] : action de suite (« Voir l'incident »…), appelée APRÈS
/// la fermeture de l'écran.
Future<void> showSuccess(
  BuildContext context, {
  required String title,
  String? body,
  String illustration = 'ok-general',
  String? doneLabel,
  String? secondaryLabel,
  VoidCallback? onSecondary,
}) async {
  // Écriture confirmée par le serveur : vibration + son de succès (réglages Sensations).
  Haptics.success();
  Sounds.play(SuSound.success);
  final next = await Navigator.of(context, rootNavigator: true).push<bool>(PageRouteBuilder<bool>(
    opaque: true,
    transitionDuration: SuMotion.of(context, const Duration(milliseconds: 420)),
    reverseTransitionDuration: SuMotion.of(context, const Duration(milliseconds: 240)),
    pageBuilder: (ctx, _, __) => _SuccessPage(title: title, body: body, illustration: illustration, doneLabel: doneLabel, secondaryLabel: secondaryLabel),
    transitionsBuilder: (ctx, a, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: a, curve: SuMotion.easeOut),
      child: ScaleTransition(scale: Tween(begin: 1.04, end: 1.0).animate(CurvedAnimation(parent: a, curve: SuMotion.easeOut)), child: child),
    ),
  ));
  if (next == true) onSecondary?.call();
}

class _SuccessPage extends StatelessWidget {
  const _SuccessPage({required this.title, this.body, required this.illustration, this.doneLabel, this.secondaryLabel});
  final String title;
  final String? body;
  final String illustration;
  final String? doneLabel;
  final String? secondaryLabel;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final md = context.mdict;
    final w = MediaQuery.sizeOf(context).width;
    final reduced = SuMotion.reduced(context);
    Widget enter(Widget c, int i) => reduced ? c : c.animate().fadeIn(duration: 380.ms, delay: (380 + i * 90).ms).slideY(begin: 0.18, end: 0, duration: 520.ms, delay: (380 + i * 90).ms, curve: SuMotion.easeOut);
    return Scaffold(
      backgroundColor: SuColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: CircleIconButton(icon: Icons.close_rounded, tooltip: MaterialLocalizations.of(context).closeButtonTooltip, onTap: () => Navigator.of(context).pop(false)),
              ),
              Expanded(
                child: Center(
                  child: SuIllustration(
                    illustration,
                    size: math.min(w * 0.62, 260),
                    fallback: const SuccessBurst(),
                  ),
                ),
              ),
              enter(Text(SuType.posterText(context, title), textAlign: TextAlign.center, style: SuType.poster(context, ((w - 48) * 0.1).clamp(28.0, 42.0))), 0),
              if (body != null) ...[
                const SizedBox(height: 12),
                enter(Text(body!, textAlign: TextAlign.center, style: t.bodyLarge?.copyWith(color: SuColors.soft, height: 1.5)), 1),
              ],
              const SizedBox(height: 28),
              enter(SuButton(label: doneLabel ?? md.successDone, size: SuButtonSize.lg, expand: true, haptic: false, onPressed: () => Navigator.of(context).pop(false)), 2),
              if (secondaryLabel != null) ...[
                const SizedBox(height: 6),
                enter(Center(child: LinkButton(secondaryLabel!, onTap: () => Navigator.of(context).pop(true))), 3),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Repli code-natif du succès : anneaux sauge qui s'élargissent, disque sauge qui éclot,
/// coche encre qui se trace.
class SuccessBurst extends StatefulWidget {
  const SuccessBurst({super.key, this.size = 200});
  final double size;
  @override
  State<SuccessBurst> createState() => _SuccessBurstState();
}

class _SuccessBurstState extends State<SuccessBurst> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (SuMotion.reduced(context)) {
      _c.value = 1;
    } else if (!_c.isAnimating && _c.value == 0) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
        width: widget.size,
        height: widget.size,
        child: RepaintBoundary(child: CustomPaint(painter: _BurstPainter(_c))),
      );
}

class _BurstPainter extends CustomPainter {
  _BurstPainter(this.a) : super(repaint: a);
  final Animation<double> a;

  @override
  void paint(Canvas c, Size s) {
    final t = a.value;
    final center = s.center(Offset.zero);
    final r = s.width / 2;
    // Anneaux qui s'élargissent et s'effacent.
    for (int i = 0; i < 2; i++) {
      final p = ((t - i * 0.12) / 0.7).clamp(0.0, 1.0);
      if (p <= 0 || p >= 1) continue;
      c.drawCircle(center, r * (0.45 + 0.55 * p), Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = SuColors.sage.withValues(alpha: (1 - p) * 0.8));
    }
    // Disque qui éclot (ressort).
    final d = SuMotion.spring.transform((t / 0.45).clamp(0.0, 1.0));
    c.drawCircle(center, r * 0.42 * d, Paint()..color = SuColors.cta);
    // Petites pastilles de fête.
    final dots = (t - 0.25).clamp(0.0, 0.6) / 0.6;
    if (dots > 0 && dots < 1) {
      for (int i = 0; i < 8; i++) {
        final ang = i * math.pi / 4 + 0.3;
        final dist = r * (0.5 + 0.38 * dots);
        c.drawCircle(center + Offset(math.cos(ang), math.sin(ang)) * dist, 5 * (1 - dots), Paint()..color = i.isEven ? SuColors.actionDeep : SuColors.sandMid);
      }
    }
    // Coche tracée.
    final k = ((t - 0.35) / 0.4).clamp(0.0, 1.0);
    if (k > 0) {
      final path = Path()
        ..moveTo(center.dx - r * 0.17, center.dy + r * 0.01)
        ..lineTo(center.dx - r * 0.04, center.dy + r * 0.14)
        ..lineTo(center.dx + r * 0.2, center.dy - r * 0.13);
      final metric = path.computeMetrics().first;
      c.drawPath(metric.extractPath(0, metric.length * SuMotion.easeOut.transform(k)), Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.075
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = SuColors.ink);
    }
  }

  @override
  bool shouldRepaint(covariant _BurstPainter old) => false;
}
