import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/abonnement/abonnement_gate.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/widgets.dart';

Future<void> _ouvrir(Uri uri) async {
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) await launchUrl(uri);
}

/// Boutons de contact SyndicUp (WhatsApp / e-mail) — coordonnées fournies par l'API.
class _Contact extends StatelessWidget {
  const _Contact({required this.a, required this.message});
  final AbonnementResidence a;
  final String message;

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final wa = a.contactWhatsapp?.replaceAll(RegExp(r'\D'), '');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (wa != null && wa.isNotEmpty)
          SuButton(
            label: md.aboWhatsapp,
            icon: Icons.chat_rounded,
            expand: true,
            onPressed: () => _ouvrir(Uri.parse('https://wa.me/$wa?text=${Uri.encodeComponent(message)}')),
          ),
        if (a.contactEmail != null) ...[
          const SizedBox(height: 10),
          SuButton(
            label: md.aboEmail,
            variant: SuButtonVariant.secondary,
            expand: true,
            onPressed: () => _ouvrir(Uri(scheme: 'mailto', path: a.contactEmail, queryParameters: {'subject': message})),
          ),
        ],
      ],
    );
  }
}

/// Résidence fermée (abonnement suspendu, résilié ou impayé au-delà du délai de grâce) : écran
/// plein. Le syndic voit comment rétablir l'accès ; les résidents, un message rassurant.
class AbonnementSuspenduScreen extends ConsumerWidget {
  const AbonnementSuspenduScreen({super.key, required this.abonnement});
  final AbonnementResidence abonnement;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final app = ref.watch(appStateProvider).valueOrNull;
    final ctx = app is AppReady ? app.ctx : null;
    final residence = ctx?.copropriete?.nom ?? 'SyndicUp';
    final autres = (ctx?.coproprietes ?? const []).where((c) => c.id != ctx?.coproprieteId).toList();
    final corps = abonnement.etat == 'RESILIE'
        ? fill(md.aboResilie, {'residence': residence})
        : abonnement.gestionnaire
            ? fill(md.aboSuspenduGestion, {'residence': residence})
            : fill(md.aboSuspenduResident, {'residence': residence});
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: SuColors.surface,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 380),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: Brand(size: 44)),
                    const SizedBox(height: 36),
                    const Icon(Icons.lock_clock_rounded, size: 56, color: SuColors.warn),
                    const SizedBox(height: 16),
                    Text(md.aboSuspenduTitre, textAlign: TextAlign.center, style: t.displayMedium),
                    const SizedBox(height: 10),
                    Text(corps, textAlign: TextAlign.center, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
                    const SizedBox(height: 28),
                    if (abonnement.gestionnaire) ...[
                      _Contact(a: abonnement, message: '${md.aboSuspenduTitre} — $residence'),
                      const SizedBox(height: 10),
                    ],
                    SuButton(
                      label: md.aboReessayer,
                      variant: SuButtonVariant.ghost,
                      expand: true,
                      onPressed: () => ref.invalidate(abonnementProvider),
                    ),
                    for (final c in autres.take(3))
                      SuButton(
                        label: '${md.aboAutreResidence} · ${c.nom}',
                        variant: SuButtonVariant.ghost,
                        expand: true,
                        onPressed: () async {
                          await ref.read(sessionProvider.notifier).chooseCopropriete(c.id);
                          ref.invalidate(appStateProvider);
                        },
                      ),
                    const SizedBox(height: 8),
                    SuButton(
                      label: context.dict.common.logout,
                      variant: SuButtonVariant.secondary,
                      expand: true,
                      onPressed: () => ref.read(sessionProvider.notifier).signOut(),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Fenêtre de rappel (syndic uniquement) au-dessus de l'app : douce avant l'échéance (RAPPEL),
/// avec la date de coupure après (GRACE). Refermable ; revient au prochain lancement.
class AbonnementRappelOverlay extends ConsumerWidget {
  const AbonnementRappelOverlay({super.key, required this.abonnement});
  final AbonnementResidence abonnement;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(abonnementRappelFermeProvider) == abonnement.cle) return const SizedBox.shrink();
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final loc = context.locale;
    final a = abonnement;
    final grace = a.niveau == 'GRACE';
    final essai = a.etat == 'EN_ESSAI';
    final jours = a.joursAvantEcheance ?? 0;
    final titre = grace
        ? md.aboGraceTitre
        : essai
            ? (jours <= 0 ? md.aboEssaiFinAujourdhui : fill(md.aboEssaiFinDans, {'n': jours}))
            : fill(md.aboRenouvellementTitre, {'date': formatDate(a.echeance, loc)});
    final corps = grace
        ? fill(md.aboGraceCorps, {'echeance': formatDate(a.echeance, loc), 'blocage': formatDate(a.dateBlocage, loc)})
        : essai
            ? md.aboEssaiCorps
            : md.aboRenouvellementCorps;
    final app = ref.watch(appStateProvider).valueOrNull;
    final residence = app is AppReady ? (app.ctx.copropriete?.nom ?? '') : '';
    void fermer() => ref.read(abonnementRappelFermeProvider.notifier).state = a.cle;

    return Material(
      color: SuColors.ink.withValues(alpha: 0.45),
      child: SafeArea(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SuCard(
                color: SuColors.surface,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(grace ? Icons.error_outline_rounded : Icons.event_available_rounded, color: grace ? SuColors.warn : SuColors.action),
                          const SizedBox(width: 10),
                          Expanded(child: Text(titre, style: t.titleLarge)),
                        ],
                      ),
                      if (grace && a.joursAvantBlocage != null) ...[
                        const SizedBox(height: 10),
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: (a.joursAvantBlocage! <= 2) ? SuColors.danger : SuColors.warn, borderRadius: BorderRadius.circular(999)),
                            child: Text(
                              a.joursAvantBlocage! <= 0 ? md.aboDernierJour : fill(md.aboGraceJours, {'n': a.joursAvantBlocage}),
                              style: t.labelMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Text(corps, style: t.bodyLarge?.copyWith(color: SuColors.body)),
                      const SizedBox(height: 18),
                      _Contact(a: a, message: '$titre — $residence'),
                      const SizedBox(height: 6),
                      SuButton(label: grace ? md.aboCompris : md.aboPlusTard, variant: SuButtonVariant.ghost, expand: true, onPressed: fermer),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
