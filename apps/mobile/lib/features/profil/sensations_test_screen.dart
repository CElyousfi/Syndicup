import 'package:flutter/material.dart';

import '../../core/feel/feel.dart';
import '../../core/i18n/i18n.dart';
import '../../core/widgets/widgets.dart';

/// Écran caché (debug / SENSATIONS_TEST) : joue chaque son et chaque vibration de la couche
/// Alive pour les juger sur un vrai téléphone. Les sons ignorent le réglage « Sons » ; les
/// vibrations passent par le service (donc par son anti-rafale de 80 ms et le réglage).
class SensationsTestScreen extends StatelessWidget {
  const SensationsTestScreen({super.key});

  static final Map<String, VoidCallback> _haptics = {
    'tap()': Haptics.tap,
    'select()': Haptics.select,
    'success()': Haptics.success,
    'warning()': Haptics.warning,
    'error()': Haptics.error,
    'heavy()': Haptics.heavy,
  };

  /// Démonstrations des moments signature (aucune écriture : animation, vibration et son seuls).
  static final Map<String, void Function(BuildContext)> moments = {
    '1 · Paiement enregistré (écran de succès)': (c) => showSuccess(c, title: c.dict.alive.paiementEnregistre, illustration: 'ok-paiement', moment: SuMomentKind.payment, amount: '1250.00'),
    '1 bis · Paiement enregistré (calque)': (c) => SuSignature.payment(c, amount: '1250.00', balanceBefore: '-1250.00', balanceAfter: '0.00'),
    '2 · Les 12 annexes générées': (c) => SuSignature.annexes(c),
    '3 · Appel de fonds / relance envoyé': (c) => showSuccess(c, title: c.dict.alive.envoye, illustration: 'ok-general', moment: SuMomentKind.sent),
    '4 · Vote d\'AG': (c) => SuSignature.vote(c),
    '5 · Dépense justifiée': (c) => showSuccess(c, title: c.dict.alive.justifiee, illustration: 'ok-paiement', moment: SuMomentKind.justified),
    '6 · Résidence 100 % à jour (halo)': (c) => showSuDialog<void>(c, builder: (ctx) => Center(child: Material(color: Colors.transparent, child: SuRing(1, size: 120, stroke: 10, glow: true, child: const Icon(Icons.verified_rounded, size: 48, color: Colors.white))))),
    '7 · Bienvenue': (c) => SuSignature.play(c, (t) => SuMomentView(kind: SuMomentKind.welcome, onPeak: Haptics.success)),
  };

  @override
  Widget build(BuildContext context) {
    final a = context.dict.alive;
    return SuPage(
      title: a.test,
      subtitle: a.testAide,
      children: [
        SectionHeader(a.testSons),
        CardList([
          for (final s in SuSound.values)
            ListRow(
              leading: const IconCircle(Icons.volume_up_rounded, tone: Tone.lilac),
              title: s.name,
              subtitle: 'assets/sounds/${s.name}.wav',
              trailing: LinkButton(a.jouer, onTap: () => Sounds.play(s, ignorePrefs: true)),
              onTap: () => Sounds.play(s, ignorePrefs: true),
            ),
        ]),
        SectionHeader(a.testVibrations),
        CardList([
          for (final e in _haptics.entries)
            ListRow(
              leading: const IconCircle(Icons.vibration_rounded, tone: Tone.sand),
              title: 'Haptics.${e.key}',
              trailing: LinkButton(a.jouer, onTap: e.value),
              onTap: e.value,
            ),
        ]),
        if (moments.isNotEmpty) ...[
          SectionHeader(a.testMoments),
          CardList([
            for (final e in moments.entries)
              ListRow(
                leading: const IconCircle(Icons.auto_awesome_rounded, tone: Tone.sage),
                title: e.key,
                onTap: () => e.value(context),
              ),
          ]),
        ],
      ],
    );
  }
}
