import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/swr.dart';
import '../format/format.dart';
import '../i18n/i18n.dart';
import '../i18n/mobile_dict.dart';
import '../theme/tokens.dart';
import 'cards.dart';

/// Bandeau fin « Données du 14:02 — serveur injoignable · Réessayer » : la liste affichée vient
/// de la copie du téléphone parce que le serveur n'a pas répondu (Wi-Fi sans internet, API en
/// panne). Rien quand les données sont à jour. Branché par `SuPage(staleKeys: ['/annonces'])`.
class StaleBanner extends ConsumerWidget {
  const StaleBanner(this.paths, {super.key, this.onRetry});

  /// Chemins de l'API lus par l'écran (ceux passés à `swr`).
  final List<String> paths;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    DateTime? since;
    for (final p in paths) {
      final s = ref.watch(staleProvider(p));
      if (s != null && (since == null || s.isBefore(since))) since = s;
    }
    final quand = since;
    if (quand == null) return const SizedBox.shrink();
    final l = context.locale;
    final up = context.mup;
    final now = DateTime.now();
    final memeJour = quand.year == now.year && quand.month == now.month && quand.day == now.day;
    final iso = quand.toIso8601String();
    final texte = memeJour ? fill(up.staleAt, {'heure': formatHeure(iso, l)}) : fill(up.staleOn, {'date': formatDateCourte(iso, l), 'heure': formatHeure(iso, l)});
    final t = Theme.of(context).textTheme;
    final retry = onRetry;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 8, 8),
          decoration: BoxDecoration(color: SuColors.warnTint, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              const Icon(Icons.cloud_off_rounded, size: 18, color: SuColors.warn),
              const SizedBox(width: 8),
              Expanded(child: Text(texte, style: t.bodySmall?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600))),
              if (retry != null) ...[
                const SizedBox(width: 8),
                LinkButton(context.mdict.ux.actRetry, onTap: () => retry()),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
