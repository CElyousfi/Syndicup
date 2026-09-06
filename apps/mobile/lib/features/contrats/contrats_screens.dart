import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/format/centimes.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../documents/document_viewer_screen.dart';

/// M19 Contrats, assurances, échéances (Doc A §7, §8) — mobile en LECTURE (syndic / conseil) :
/// liste par statut avec l'état de l'assurance immeuble, échéances des 30 prochains jours, fiche
/// contrat (échéancier, police, documents dans la visionneuse, dépenses liées, journal). Création,
/// activation, résiliation, génération de dépense et calendrier restent web-first
/// (docs/PARITE_WEB_MOBILE.md) ; les pushs CONTRAT_* / ASSURANCE_* ouvrent ces écrans.

const _onglets = ['TOUS', 'ACTIF', 'A_RENOUVELER', 'BROUILLON', 'SUSPENDU', 'EXPIRE', 'RESILIE'];

class ContratsScreen extends ConsumerStatefulWidget {
  const ContratsScreen({super.key});
  @override
  ConsumerState<ContratsScreen> createState() => _ContratsScreenState();
}

class _ContratsScreenState extends ConsumerState<ContratsScreen> {
  String _onglet = 'TOUS';
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final statut = _onglet == 'TOUS' ? null : _onglet;
    final contrats = ref.watch(contratsProvider(statut));
    final assurance = ref.watch(assuranceProvider).valueOrNull;
    final prochaines = ref.watch(echeancierProchainProvider).valueOrNull ?? const <ContratEcheance>[];
    final aRenouveler = ref.watch(contratsProvider('A_RENOUVELER')).valueOrNull ?? const <Contrat>[];
    return SuPage(
      title: d.contrats.titre,
      subtitle: d.contrats.subtitle,
      onRefresh: () async {
        ref.invalidate(contratsProvider);
        ref.invalidate(assuranceProvider);
        ref.invalidate(echeancierProchainProvider);
      },
      children: [
        if (assurance != null && !assurance.immeubleActive) ...[
          SuBanner(tone: BannerTone.danger, title: d.contrats.assuranceAbsente, body: d.contrats.assuranceAbsenteCorps),
          const SizedBox(height: 12),
        ],
        TwoCols([
          StatTile(label: d.contrats.aRenouveler, value: '${aRenouveler.length}', icon: Icons.event_repeat_rounded, tone: aRenouveler.isNotEmpty ? Tone.warn : Tone.sage, hint: d.contrats.aRenouvelerAide, onTap: () => setState(() => _onglet = 'A_RENOUVELER')),
          StatTile(label: d.contrats.echeances30, value: '${prochaines.length}', icon: Icons.calendar_month_rounded, tone: Tone.tosca, hint: prochaines.isEmpty ? null : formatMAD(_somme(prochaines), l)),
        ]),
        const SizedBox(height: 12),
        if (prochaines.isNotEmpty) ...[
          SectionHeader(d.contrats.echeances30),
          CardList([
            for (final e in prochaines.take(6))
              ListRow(
                leading: IconCircle(_iconeEcheance(e.type), tone: e.statut == 'MANQUEE' ? Tone.danger : Tone.tosca, size: 40),
                title: e.contratLibelle ?? d.contrats.titre,
                subtitle: '${formatDateCourte(e.dateEcheance, l)} · ${d.enumsContrats.typeEcheance[e.type] ?? e.type}',
                trailing: e.montant != null ? MoneyText(formatMAD(e.montant, l)) : StatusBadge(d.enumsContrats.statutEcheance[e.statut] ?? e.statut, variant: echeanceVariant[e.statut] ?? BadgeVariant.neutral, small: true),
                onTap: () => context.push('/contrats/${e.contratId}'),
              ),
          ]),
        ],
        SectionHeader(d.contrats.liste),
        FilterChips<String>(value: _onglet, options: _onglets, labelOf: (s) => s == 'TOUS' ? d.contrats.tous : s == 'A_RENOUVELER' ? d.contrats.aRenouveler : (d.enumsContrats.statutContrat[s] ?? s), onChanged: (v) => setState(() => _onglet = v)),
        const SizedBox(height: 12),
        AsyncView(
          contrats,
          onRetry: () => ref.invalidate(contratsProvider(statut)),
          data: (rows) => rows.isEmpty
              ? EmptyState(title: statut == null ? d.contrats.aucun : d.contrats.aucunFiltre, hint: statut == null ? d.contrats.aucunAide : null, icon: Icons.handshake_rounded)
              : CardList([for (final c in rows) _ContratRow(c)]),
        ),
        const SizedBox(height: 8),
        Text(d.contrats.echeancierAide, style: t.labelSmall),
      ],
    );
  }
}

String _somme(List<ContratEcheance> es) {
  var total = BigInt.zero;
  for (final e in es) {
    if (e.montant != null) total += versCentimes(e.montant);
  }
  return versChaine(total);
}

IconData _iconeEcheance(String type) => switch (type) {
      'PAIEMENT' => Icons.payments_rounded,
      'RENOUVELLEMENT' => Icons.event_repeat_rounded,
      'VISITE_TECHNIQUE' => Icons.engineering_rounded,
      'CONTROLE_REGLEMENTAIRE' => Icons.verified_rounded,
      _ => Icons.event_note_rounded,
    };

IconData _iconeContrat(String type) => switch (type) {
      'ASSURANCE_IMMEUBLE' || 'ASSURANCE_RC' => Icons.shield_rounded,
      'ASCENSEUR' => Icons.elevator_rounded,
      'NETTOYAGE' => Icons.cleaning_services_rounded,
      'GARDIENNAGE' => Icons.security_rounded,
      'JARDINAGE' => Icons.yard_rounded,
      'EAU' => Icons.water_drop_rounded,
      'ELECTRICITE' => Icons.bolt_rounded,
      'INTERNET' => Icons.wifi_rounded,
      'TRAVAUX' => Icons.construction_rounded,
      _ => Icons.handshake_rounded,
    };

class _ContratRow extends StatelessWidget {
  const _ContratRow(this.c);
  final Contrat c;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final fin = c.dateFin == null ? d.contrats.dureeIndeterminee : '${d.contrats.dateFin} ${formatDateCourte(c.dateFin, l)}';
    return ListRow(
      leading: IconCircle(_iconeContrat(c.type), tone: c.statut == 'ACTIF' ? (c.aRenouveler ? Tone.warn : Tone.sage) : c.statut == 'EXPIRE' ? Tone.danger : Tone.neutral, size: 40),
      title: c.libelle,
      subtitle: [d.enumsContrats.typeContrat[c.type] ?? c.type, if (c.prestataireNom != null) c.prestataireNom!, fin].join(' · '),
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
        if (c.montantPeriode != null) MoneyText(formatMAD(c.montantPeriode, l)),
        const SizedBox(height: 4),
        StatusBadge(d.enumsContrats.statutContrat[c.statut] ?? c.statut, variant: contratVariant[c.statut] ?? BadgeVariant.neutral, small: true),
      ]),
      onTap: () => context.push('/contrats/${c.id}'),
    );
  }
}

class ContratDetailScreen extends ConsumerWidget {
  const ContratDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final contrat = ref.watch(contratProvider(id));
    return SuPage(
      title: contrat.valueOrNull?.libelle ?? d.contrats.titre,
      subtitle: contrat.valueOrNull == null ? null : d.enumsContrats.typeContrat[contrat.valueOrNull!.type],
      onRefresh: () async => ref.invalidate(contratProvider(id)),
      children: [
        AsyncView(contrat, onRetry: () => ref.invalidate(contratProvider(id)), data: (c) {
          final det = c.detailsAssurance;
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SuCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 6, runSpacing: 6, children: [
                  StatusBadge(d.enumsContrats.statutContrat[c.statut] ?? c.statut, variant: contratVariant[c.statut] ?? BadgeVariant.neutral),
                  StatusBadge(d.enumsContrats.periodicite[c.periodicite] ?? c.periodicite, variant: BadgeVariant.outline),
                  if (c.tacite) StatusBadge(d.contrats.tacite, variant: BadgeVariant.info),
                ]),
                const SizedBox(height: 14),
                if (c.montantPeriode != null) ...[
                  Text(d.contrats.montantPeriode, style: t.labelMedium),
                  MoneyText(formatMAD(c.montantPeriode, l), style: t.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                ],
                KeyValueRow(d.contrats.dateDebut, formatDate(c.dateDebut, l)),
                KeyValueRow(d.contrats.dateFin, c.dateFin != null ? formatDate(c.dateFin, l) : d.contrats.dureeIndeterminee),
                if (c.joursAvantFin != null && c.statut == 'ACTIF') KeyValueRow(d.contrats.aRenouveler, fill(d.contrats.joursAvantFin, {'n': c.joursAvantFin!})),
                if (c.preavisJours != null) KeyValueRow(d.contrats.preavis, '${c.preavisJours}'),
                if (c.reference != null) KeyValueRow(d.contrats.reference, c.reference!, mono: true),
                if (c.prestataireNom != null) KeyValueRow(d.contrats.prestataire, c.prestataireNom!),
                KeyValueRow(d.contrats.poste, c.posteLibelle ?? d.contrats.horsPoste),
                if (c.resolutionTexte != null) KeyValueRow(d.contrats.resolutionAg, c.resolutionTexte!),
                if (c.notes != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(c.notes!, style: t.bodyMedium?.copyWith(color: SuColors.ink))),
              ]),
            ),
            if (c.statut == 'RESILIE' && c.motifResiliation != null) ...[
              const SizedBox(height: 12),
              SuBanner(tone: BannerTone.warn, title: d.contrats.motifResiliation, body: c.motifResiliation!),
            ],
            if (c.estAssurance) ...[
              SectionHeader(d.contrats.assurance),
              SuCard(child: det == null
                  ? Text('—', style: t.bodySmall)
                  : Column(children: [
                      KeyValueRow(d.contrats.assureur, (det['assureur'] ?? '—').toString()),
                      KeyValueRow(d.contrats.numeroPolice, (det['numero_police'] ?? '—').toString(), mono: true),
                      if (det['franchise'] != null) KeyValueRow(d.contrats.franchise, formatMAD(det['franchise'].toString(), l)),
                      if (det['capital_assure'] != null) KeyValueRow(d.contrats.capitalAssure, formatMAD(det['capital_assure'].toString(), l)),
                      if ((det['garanties'] as List?)?.isNotEmpty ?? false)
                        Padding(padding: const EdgeInsets.only(top: 8), child: Align(alignment: AlignmentDirectional.centerStart, child: Wrap(spacing: 6, runSpacing: 6, children: [for (final g in (det['garanties'] as List)) StatusBadge(g.toString(), variant: BadgeVariant.neutral, small: true)]))),
                    ])),
            ],
            if (c.documentId != null || c.attestationId != null) ...[
              SectionHeader(d.nav.documents),
              CardList([
                if (c.documentId != null) ListRow(leading: const IconCircle(Icons.description_rounded, tone: Tone.sage, size: 40), title: d.contrats.documentSigne, subtitle: c.documentNom, chevron: true, onTap: () => ouvrirFichierApi(context, ref, endpoint: '/documents/${c.documentId}/download-url', titre: c.documentNom ?? d.contrats.documentSigne)),
                if (c.attestationId != null) ListRow(leading: const IconCircle(Icons.verified_user_rounded, tone: Tone.tosca, size: 40), title: d.contrats.attestation, subtitle: c.attestationNom, chevron: true, onTap: () => ouvrirFichierApi(context, ref, endpoint: '/documents/${c.attestationId}/download-url', titre: c.attestationNom ?? d.contrats.attestation)),
              ]),
            ],
            SectionHeader(d.contrats.echeancier, subtitle: '${c.echeances.length}'),
            if (c.echeances.isEmpty)
              SuCard(child: Text(d.contrats.aucuneEcheance, style: t.bodySmall))
            else
              CardList([
                for (final e in c.echeances)
                  ListRow(
                    leading: IconCircle(_iconeEcheance(e.type), tone: e.statut == 'MANQUEE' ? Tone.danger : e.statut == 'A_VENIR' ? Tone.tosca : Tone.sage, size: 40),
                    title: '${formatDate(e.dateEcheance, l)} · ${d.enumsContrats.typeEcheance[e.type] ?? e.type}',
                    subtitle: e.depenseLibelle != null ? '${e.depenseLibelle} · ${d.enumsDepenses.statutDepense[e.depenseStatut ?? ''] ?? ''}' : null,
                    trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                      if (e.montant != null) MoneyText(formatMAD(e.montant, l)),
                      const SizedBox(height: 4),
                      StatusBadge(d.enumsContrats.statutEcheance[e.statut] ?? e.statut, variant: echeanceVariant[e.statut] ?? BadgeVariant.neutral, small: true),
                    ]),
                    onTap: e.depenseId != null && ctx.voitDepenses ? () => context.push('/depenses/${e.depenseId}') : null,
                  ),
              ]),
            if (c.depenses.isNotEmpty) ...[
              SectionHeader(d.contrats.depensesLiees),
              CardList([for (final dep in c.depenses) ListRow(leading: const IconCircle(Icons.receipt_long_rounded, tone: Tone.sand, size: 40), title: dep.nom, chevron: true, onTap: () => context.push('/depenses/${dep.id}'))]),
            ],
            if (c.logs.isNotEmpty) ...[
              SectionHeader(d.contrats.journal),
              SuCard(child: Column(children: [
                for (final lg in c.logs.reversed.take(10))
                  KeyValueRow(d.contrats.journalTypes[(lg['type'] ?? '').toString()] ?? (lg['type'] ?? '').toString(), formatDateCourte(lg['horodatage']?.toString(), l)),
              ])),
            ],
            const SizedBox(height: 12),
            Text(d.contrats.nouveauAide, style: t.labelSmall),
          ]);
        }),
      ],
    );
  }
}
