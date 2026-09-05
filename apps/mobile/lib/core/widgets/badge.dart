import 'package:flutter/material.dart';

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
      BadgeVariant.neutral => (SuColors.ground, SuColors.ink, SuColors.ground),
      BadgeVariant.outline => (SuColors.surface, SuColors.ink, SuColors.hairlineStrong),
    };
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(SuRadius.pill), border: Border.all(color: border)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (pulse) ...[
            _Pulse(color: fg),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: TextStyle(fontSize: small ? 11 : 12, fontWeight: FontWeight.w600, color: fg, height: 1.2, fontFamily: variant == BadgeVariant.ink ? 'GeistMono' : null, letterSpacing: variant == BadgeVariant.ink ? -0.3 : null),
          ),
        ],
      ),
    );
  }
}

class _Pulse extends StatefulWidget {
  const _Pulse({required this.color});
  final Color color;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
        opacity: Tween(begin: 0.35, end: 1.0).animate(_c),
        child: Container(width: 6, height: 6, decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle)),
      );
}
