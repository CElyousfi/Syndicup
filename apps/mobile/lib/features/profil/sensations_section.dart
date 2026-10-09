import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/feel/feel.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';

/// Écran de test des sensations : visible en debug, ou avec `--dart-define=SENSATIONS_TEST=true`
/// (APK de revue sur un vrai téléphone).
const bool sensationsTestEnabled = kDebugMode || bool.fromEnvironment('SENSATIONS_TEST');

/// Réglages « Sensations » (profil) — animations complètes / réduites, vibrations, sons.
/// Gardés sur l'appareil (décision D2), appliqués immédiatement.
class SensationsSection extends StatelessWidget {
  const SensationsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final a = context.dict.alive;
    final t = Theme.of(context).textTheme;
    return ListenableBuilder(
      listenable: Feel.changes,
      builder: (context, _) {
        final p = Sensations.instance.prefs.value;
        void set(SensationsPrefs next) => Sensations.instance.update(next);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionHeader(a.sensations, subtitle: a.sensationsAide),
            SuCard(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(a.animations, style: t.labelMedium?.copyWith(color: SuColors.ink)),
                  const SizedBox(height: 10),
                  Segmented<bool>(
                    value: p.reducedMotion,
                    options: const [false, true],
                    labelOf: (v) => v ? a.animationsReduites : a.animationsCompletes,
                    onChanged: (v) => set(p.copyWith(reducedMotion: v)),
                  ),
                  const SizedBox(height: 8),
                  Text(a.animationsAide, style: t.bodySmall),
                  const SizedBox(height: 10),
                  SuSwitchRow(
                    label: a.vibrations,
                    help: a.vibrationsAide,
                    value: p.haptics,
                    onChanged: (v) {
                      set(p.copyWith(haptics: v));
                      if (v) Haptics.select();
                    },
                  ),
                  SuSwitchRow(label: a.sons, help: a.sonsAide, value: p.sounds, onChanged: (v) => set(p.copyWith(sounds: v))),
                  if (Feel.lite)
                    Padding(
                      padding: const EdgeInsets.only(top: 8, bottom: 6),
                      child: SuBanner(body: a.lite),
                    ),
                ],
              ),
            ),
            if (sensationsTestEnabled)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: CardList([
                  ListRow(
                    leading: const IconCircle(Icons.graphic_eq_rounded, tone: Tone.lilac),
                    title: a.test,
                    subtitle: a.testAide,
                    onTap: () => context.push('/debug/sensations'),
                  ),
                ]),
              ),
          ],
        );
      },
    );
  }
}
