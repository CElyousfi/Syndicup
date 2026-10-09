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

  /// Démonstrations des moments signature (enregistrées par la phase 4, voir signature.dart).
  static final Map<String, void Function(BuildContext)> moments = {};

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
