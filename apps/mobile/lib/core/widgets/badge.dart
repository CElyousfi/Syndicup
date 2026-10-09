import 'package:flutter/material.dart';

import '../feel/feel.dart';
import '../theme/motion.dart';
import '../theme/tokens.dart';
import '../util/status.dart';

/// Badge de statut — copie de components/ui/badge.tsx : pills PLEINES (rayon 999), fond couleur
/// franche et texte blanc (ok / warn / danger / info tosca profond / ink mono), ou fond greige
/// texte encre (neutral), ou liseré discret (outline). Jamais de texte coloré sur teinte.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, {super.key, this.variant = BadgeVariant.neutral, this.pulse = false, this.small = false});
  final String label;
  final BadgeVariant variant;
  final bool pulse;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, Color border) = switch (variant) {
      BadgeVariant.ok => (SuColors.ok, Colors.white, SuColors.ok),
      BadgeVariant.warn => (SuColors.warn, Colors.white, SuColors.warn),
      BadgeVariant.danger => (SuColors.danger, Colors.white, SuColors.danger),
      BadgeVariant.info => (SuColors.toscaDeep, Colors.white, SuColors.toscaDeep),
      BadgeVariant.ink => (SuColors.ink, Colors.white, SuColors.ink),
      BadgeVariant.neutral => (SuColors.washStrong, SuColors.ink, Colors.transparent),
      BadgeVariant.outline => (SuColors.surface, SuColors.ink, SuColors.hairlineStrong),
    };
    final pill = Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 9 : 11, vertical: small ? 3 : 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(SuRadius.pill), border: Border.all(color: border)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (pulse) ...[
            _Pulse(key: ValueKey(('pulse', label, variant)), color: fg),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: TextStyle(fontSize: small ? 11.5 : 12.5, fontWeight: FontWeight.w600, color: fg, height: 1.2, fontFamily: variant == BadgeVariant.ink ? 'GeistMono' : null, letterSpacing: variant == BadgeVariant.ink ? -0.3 : null),
          ),
        ],
      ),
    );
    // Vivant : quand le statut CHANGE, la pastille éclot en ressort (jamais en boucle).
    if (!Feel.alive) return pill;
    return _Pop(value: (label, variant), child: pill);
  }
}

class _Pop extends StatefulWidget {
  const _Pop({required this.value, required this.child});
  final Object value;
  final Widget child;
  @override
  State<_Pop> createState() => _PopState();
}

class _PopState extends State<_Pop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: SuTokens.slow, value: 1);

  @override
  void didUpdateWidget(_Pop old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && !SuMotion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScaleTransition(
        scale: TweenSequence([
          TweenSequenceItem(tween: Tween(begin: 0.6, end: 1.12).chain(CurveTween(curve: SuMotion.easeOut)), weight: 60),
          TweenSequenceItem(tween: Tween(begin: 1.12, end: 1.0).chain(CurveTween(curve: Curves.easeInOut)), weight: 40),
        ]).animate(_c),
        child: widget.child,
      );
}

/// Pastille « en cours » : UNE pulsation douce à l'apparition ou au changement de statut,
/// puis immobile (règle de retenue : aucune boucle qui réclame l'attention).
class _Pulse extends StatefulWidget {
  const _Pulse({super.key, required this.color});
  final Color color;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900), value: 1);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && Feel.alive && !SuMotion.reduced(context)) _c.forward(from: 0);
    });
  }
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: TweenSequence([
          TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.3), weight: 50),
          TweenSequenceItem(tween: Tween(begin: 0.3, end: 1.0), weight: 50),
        ]).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
        child: Container(width: 6, height: 6, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle)),
      );
}
