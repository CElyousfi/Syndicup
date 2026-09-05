import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/format/centimes.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/realtime/notifications_live.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/notifications_link.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../../offline/sync_queue/visites_sync.dart';
import '../documents/documents_screen.dart';
import '../shell/app_shell.dart';

/// B1→B5 : LE tableau de bord est différent par rôle.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final Widget body = switch (ctx.role) {
      'SYNDIC' => const _DashSyndic(lectureSeule: false),
      'CONSEIL_SYNDICAL' => const _DashSyndic(lectureSeule: true),
      'GARDIEN' => const _DashGardien(),
      'PRESTATAIRE' => const _DashPrestataire(),
      'LOCATAIRE' => const _DashResident(locataire: true),
      _ => const _DashResident(locataire: false),
    };
    return Scaffold(appBar: const ShellHeader(), body: body);
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.ctx, this.subtitle});
  final AppContext ctx;
  final String? subtitle;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final d = context.dict;
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(
              style: t.displayMedium?.copyWith(fontWeight: FontWeight.w400),
              children: [
                TextSpan(text: fill(d.dash.greeting, {'prenom': ''}).trimRight()),
                const TextSpan(text: ' '),
                TextSpan(text: '${ctx.profil.prenom ?? nomCompletProfil(ctx) ?? ''}!', style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(subtitle!, style: t.bodyMedium)),
        ],
      ),
    );
  }
}

String echeanceRelative(BuildContext context, String iso) {
  final d = context.dict;
  final j = joursRestants(iso);
  if (j == 0) return d.ag.aujourdhui;
  if (j == 1) return d.ag.demain;
  if (j > 1) return fill(d.ag.dansJours, {'n': j});
  return '';
}

// ── B1 / B4 ───────────────────────────────────────────────────────────────────
class _DashSyndic extends ConsumerWidget {
  const _DashSyndic({required this.lectureSeule});
  final bool lectureSeule;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final synthese = ref.watch(syntheseProvider);
    final incidents = ref.watch(incidentsProvider);
    final ags = ref.watch(agListProvider);
    final reservations = ref.watch(reservationsProvider);
    final lots = ref.watch(lotsProvider);
    final litiges = ref.watch(litigesProvider);
    final documents = ref.watch(documentsProvider);

    Future<void> refresh() async {
      ref.invalidate(syntheseProvider);
      ref.invalidate(incidentsProvider);
      ref.invalidate(agListProvider);
      ref.invalidate(reservationsProvider);
      ref.invalidate(lotsProvider);
      ref.invalidate(litigesProvider);
      ref.invalidate(documentsProvider);
    }

    final s = synthese.valueOrNull ?? const SyntheseFinanciere();
    final tot = totauxGlobaux(s);
    final parNiveau = impayesParNiveau(s);
    final totaux = totauxParAppel(s);
    final ouverts = (incidents.valueOrNull ?? const <Incident>[]).where((i) => i.ouvert).toList();
    final sla = ouverts.where((i) => i.slaDepasse).toList();
    final prochaine = (ags.valueOrNull ?? const <AssembleeGenerale>[]).where((a) => a.aVenir).toList()..sort((a, b) => a.dateAg.compareTo(b.dateAg));
    final aValider = (reservations.valueOrNull ?? const <Reservation>[]).where((r) => r.statut == 'EN_ATTENTE').toList();
    final litigesOuverts = (litiges.valueOrNull ?? const <Litige>[]).where((x) => x.statut == 'OUVERT').toList();

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, subtitle: lectureSeule ? d.dash.controleTitle : ctx.copropriete?.nom),
          if (synthese.hasError) ErrorState(error: synthese.error!, onRetry: refresh),
          HeroCard(
            imageWidget: const CoproPhoto('accueil'),
            label: ctx.copropriete?.nom ?? d.nav.lots,
            onTap: () => context.push('/lots'),
            stats: [
              (value: '${lots.valueOrNull?.length ?? '…'}', caption: d.nav.lots),
              (value: '${(lots.valueOrNull ?? const <Lot>[]).where((x) => x.statut == 'OCCUPE').length}', caption: d.enums.statutLot['OCCUPE'] ?? ''),
            ],
          ),
          SectionHeader(d.dash.raccourcis),
          TwoCols([
            StatTile(label: d.dash.incidentsOuverts, value: '${ouverts.length}', tone: Tone.sand, hint: sla.isNotEmpty ? '${sla.length} · ${d.dash.slaDepasse}' : d.incidents.titre, onTap: () => context.push('/incidents')),
            StatTile(label: d.finances.tauxPaiement, value: synthese.isLoading ? '…' : formatPourcent(tot.taux), tone: Tone.lilac, hint: d.dash.recouvrementHint, onTap: () => context.push('/finances/appels-de-fonds')),
            StatTile(label: d.dash.impayes, value: synthese.isLoading ? '…' : formatMAD(versChaine(tot.impaye), l), tone: Tone.sage, onTap: () => context.push('/finances/appels-de-fonds')),
            StatTile(label: d.dash.reservationsAValider, value: '${aValider.length}', tone: Tone.neutral, hint: d.enums.statutReservation['EN_ATTENTE'], onTap: () => context.push('/reservations')),
          ]),
          if (!lectureSeule) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _Quick(icon: Icons.payments_rounded, label: d.finances.enregistrerPaiement, onTap: () => context.push('/finances/appels-de-fonds'))),
                const SizedBox(width: 8),
                Expanded(child: _Quick(icon: Icons.vpn_key_rounded, label: d.dash.inviterResident, onTap: () => context.push('/invitations?nouvelle=1'))),
                const SizedBox(width: 8),
                Expanded(child: _Quick(icon: Icons.request_quote_rounded, label: d.dash.genererAppel, onTap: () => context.push('/finances/appels-de-fonds?generer=1'))),
              ],
            ),
          ],
          if (parNiveau.isNotEmpty) ...[
            SectionHeader(d.dash.impayesParNiveau),
            SuCard(
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final n in parNiveau)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                      decoration: BoxDecoration(color: SuColors.ground, borderRadius: BorderRadius.circular(12)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.enums.escalade[n.niveau] ?? n.niveau, style: t.labelSmall?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w700)),
                          MoneyText(formatMAD(versChaine(n.montant), l), style: t.bodySmall?.copyWith(color: SuColors.danger, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          SectionHeader(d.finances.appels, subtitle: d.finances.appelsSubtitle, actionLabel: d.common.seeAll, onAction: () => context.push('/finances/appels-de-fonds')),
          if (s.appels.isEmpty)
            EmptyState(title: d.finances.aucunAppel, hint: d.finances.aucunAppelAide, icon: Icons.request_quote_rounded, actionLabel: lectureSeule ? null : d.finances.genererAppel, onAction: () => context.push('/finances/appels-de-fonds?generer=1'))
          else
            CardList([
              for (final a in s.appels.take(5))
                ListRow(
                  leading: const IconCircle(Icons.request_quote_rounded, tone: Tone.sand, size: 40),
                  title: formatPeriode(a.periode, l),
                  subtitle: '${d.enums.typeAppel[a.type] ?? a.type} · ${d.finances.echeance} ${formatDateCourte(a.dateEcheance, l)}',
                  trailing: SizedBox(
                    width: 120,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        MoneyText('${formatMontant(versChaine(totaux[a.id]?.paye ?? BigInt.zero))} / ${formatMontant(a.montantTotal)}', style: t.labelSmall?.copyWith(color: SuColors.ink)),
                        const SizedBox(height: 6),
                        Gauge(totaux[a.id]?.taux ?? 0, height: 6),
                      ],
                    ),
                  ),
                  onTap: () => context.push('/finances/appels-de-fonds/${a.id}'),
                ),
            ]),
          SectionHeader(d.dash.incidentsOuverts, subtitle: sla.isNotEmpty ? '${sla.length} · ${d.dash.slaDepasse}' : null, actionLabel: d.common.seeAll, onAction: () => context.push('/incidents')),
          if (ouverts.isEmpty)
            SuCard(child: Text(d.incidents.aucunIncident, style: t.bodySmall))
          else
            CardList([for (final i in ouverts.take(5)) IncidentRow(i)]),
          SectionHeader(d.dash.prochaineAg),
          _AgCard(ag: prochaine.firstOrNull, creer: lectureSeule ? null : () => context.push('/ag/nouvelle')),
          SectionHeader(lectureSeule ? d.dash.litigesOuverts : d.dash.reservationsAValider, actionLabel: d.common.seeAll, onAction: () => context.push(lectureSeule ? '/litiges' : '/reservations')),
          if (lectureSeule)
            litigesOuverts.isEmpty
                ? SuCard(child: Text(d.litiges.aucun, style: t.bodySmall))
                : CardList([for (final x in litigesOuverts.take(4)) ListRow(title: x.type, subtitle: d.enums.escaladeLitige['${x.escaladeNiveau}'], onTap: () => context.push('/litiges'))])
          else
            aValider.isEmpty
                ? SuCard(child: Text(d.espaces.aucuneReservation, style: t.bodySmall))
                : CardList([
                    for (final r in aValider.take(4))
                      ListRow(leading: const IconCircle(Icons.calendar_month_rounded, tone: Tone.tosca, size: 36), title: formatDateHeure(r.dateDebut, l), trailing: StatusBadge(d.enums.statutReservation['EN_ATTENTE']!, variant: BadgeVariant.warn, pulse: true), onTap: () => context.push('/reservations')),
                  ]),
          DocumentsCard(documents: documents.valueOrNull ?? const []),
        ],
      ),
    );
  }
}

class _Quick extends StatelessWidget {
  const _Quick({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => SuCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
        child: Column(
          children: [
            IconCircle(icon, tone: Tone.lilac, size: 40),
            const SizedBox(height: 8),
            Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w600)),
          ],
        ),
      );
}

class _AgCard extends StatelessWidget {
  const _AgCard({required this.ag, this.creer, this.resident = false});
  final AssembleeGenerale? ag;
  final VoidCallback? creer;
  final bool resident;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final a = ag;
    if (a == null) {
      return SuCard(
        child: Row(
          children: [
            const IconCircle(Icons.how_to_vote_rounded, tone: Tone.lilac),
            const SizedBox(width: 12),
            Expanded(child: Text(d.dash.aucuneAg, style: t.bodySmall)),
            if (creer != null) TextButton(onPressed: creer, child: Text(d.dash.creerAg)),
          ],
        ),
      );
    }
    return SuCard(
      onTap: () => context.push('/ag/${a.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const IconCircle(Icons.how_to_vote_rounded, tone: Tone.lilac),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(d.enums.typeAg[a.type] ?? a.type, style: t.titleSmall),
                    Text(formatDateLongue(a.dateAg, context.locale), style: t.bodySmall),
                    if (a.resolutions.isNotEmpty) Text('${a.resolutions.length} ${d.ag.resolutions.toLowerCase()}', style: t.labelSmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              StatusBadge(d.enums.statutAg[a.statut] ?? a.statut, variant: agVariant[a.statut] ?? BadgeVariant.neutral, pulse: a.statut == 'EN_COURS'),
              const Spacer(),
              Text(echeanceRelative(context, a.dateAg), style: t.labelSmall?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
          if (resident && (a.statut == 'CONVOQUEE' || a.statut == 'EN_COURS')) ...[
            const SizedBox(height: 12),
            a.statut == 'EN_COURS'
                ? FilledButton(onPressed: () => context.push('/ag/${a.id}/seance'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)), child: Text(d.ag.rejoindreSeance))
                : OutlinedButton(onPressed: () => context.push('/ag/${a.id}'), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)), child: Text(d.dash.donnerProcuration)),
          ],
        ],
      ),
    );
  }
}

/// Ligne d'incident réutilisée (dashboards, listes).
class IncidentRow extends StatelessWidget {
  const IncidentRow(this.i, {super.key});
  final Incident i;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return ListRow(
      leading: IconCircle(Icons.build_rounded, tone: i.slaDepasse ? Tone.danger : Tone.tosca, size: 40),
      title: i.sousCategorie,
      subtitle: '${d.enums.categorieIncident[i.categorie] ?? i.categorie} · ${d.enums.partie[i.partie] ?? i.partie}',
      trailing: i.slaDepasse
          ? StatusBadge(d.incidents.slaDepasse, variant: BadgeVariant.danger, pulse: true)
          : StatusBadge(d.enums.statutIncident[i.statut] ?? i.statut, variant: incidentVariant[i.statut] ?? BadgeVariant.neutral),
      onTap: () => context.push('/incidents/${i.id}'),
    );
  }
}

// ── B2 / B3 ───────────────────────────────────────────────────────────────────
class _DashResident extends ConsumerWidget {
  const _DashResident({required this.locataire});
  final bool locataire;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final lots = ref.watch(lotsProvider);
    final synthese = locataire ? null : ref.watch(syntheseProvider);
    final ags = locataire ? null : ref.watch(agListProvider);
    final incidents = ref.watch(incidentsProvider);
    final reservations = ref.watch(reservationsProvider);
    final visites = ref.watch(visitesProvider);
    final notifs = ref.watch(notificationsProvider);
    final documents = ref.watch(documentsProvider);

    Future<void> refresh() async {
      ref.invalidate(lotsProvider);
      ref.invalidate(syntheseProvider);
      ref.invalidate(agListProvider);
      ref.invalidate(incidentsProvider);
      ref.invalidate(reservationsProvider);
      ref.invalidate(visitesProvider);
      ref.invalidate(notificationsProvider);
      ref.invalidate(documentsProvider);
    }

    final mesLots = (lots.valueOrNull ?? const <Lot>[]).where((x) => x.concerne(ctx.profil.id)).toList();
    final lotsAffiches = mesLots.isEmpty ? (lots.valueOrNull ?? const <Lot>[]) : mesLots;
    final soldes = synthese?.valueOrNull == null ? <String, BigInt>{} : soldeParLot(synthese!.valueOrNull!);
    final prochaine = (ags?.valueOrNull ?? const <AssembleeGenerale>[]).where((a) => a.aVenir).toList()..sort((a, b) => a.dateAg.compareTo(b.dateAg));
    final mesIncidents = (incidents.valueOrNull ?? const <Incident>[]).where((i) => i.ouvert).toList();
    final mesResas = (reservations.valueOrNull ?? const <Reservation>[]).where((r) => r.statut == 'EN_ATTENTE' || r.statut == 'CONFIRMEE').take(5).toList();
    final mesLotIds = lotsAffiches.map((x) => x.id).toSet();
    final visitesEnAttente = (visites.valueOrNull ?? const <Visite>[]).where((v) => v.statut == 'EN_ATTENTE' && mesLotIds.contains(v.lotId)).toList();
    final totalDu = lotsAffiches.fold(BigInt.zero, (acc, x) => acc + (soldes[x.id] ?? BigInt.zero));
    final pvDispo = locataire && (ctx.copropriete?.locataireVoitPv ?? false);

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, subtitle: '${d.roles[ctx.role] ?? ctx.role}${mesLots.isNotEmpty ? ' · ${mesLots.map((x) => x.numero).join(', ')}' : ''}'),
          HeroCard(
            imageWidget: const CoproPhoto('accueil'),
            label: ctx.copropriete?.nom ?? d.lots.mesLots,
            onTap: () => context.push('/lots'),
            stats: [
              (value: '${lotsAffiches.length}', caption: d.lots.mesLots),
              if (!locataire) (value: formatMAD(versChaine(totalDu), l), caption: d.dash.monSolde),
            ],
          ),
          if (!locataire) ...[
            if (synthese!.hasError) ErrorState(error: synthese.error!, onRetry: refresh),
            SectionHeader(d.dash.monSolde, subtitle: '${d.dash.payerEnLigne} · ${d.dash.bientotDisponible}'),
            for (final lot in lotsAffiches)
              SuCard(
                margin: const EdgeInsets.only(bottom: 12),
                onTap: () => context.push('/lots/${lot.id}?onglet=finances'),
                child: _SoldeCard(lot: lot, du: soldes[lot.id] ?? BigInt.zero, loading: synthese.isLoading),
              ),
            if (lotsAffiches.isEmpty && !lots.isLoading) SuCard(child: Text(d.lots.aucunLot, style: t.bodySmall)),
          ] else ...[
            SuBanner(tone: BannerTone.info, title: md.noFinancesTitle, body: md.noFinancesBody),
          ],
          SectionHeader(d.dash.raccourcis),
          TwoCols([
            StatTile(label: d.nav.incidents, value: '${mesIncidents.length}', tone: Tone.sand, hint: d.dash.signalerIncident, onTap: () => context.push('/incidents/nouveau')),
            StatTile(label: d.dash.mesReservations, value: '${mesResas.length}', tone: Tone.lilac, hint: d.espaces.reserver, onTap: () => context.push('/espaces-communs')),
            if (!locataire) StatTile(label: d.dash.prochaineAg, value: prochaine.isEmpty ? '—' : formatDateCourte(prochaine.first.dateAg, l), tone: Tone.sage, hint: prochaine.isEmpty ? d.dash.aucuneAg : d.enums.statutAg[prochaine.first.statut], onTap: () => context.push(prochaine.isEmpty ? '/ag' : '/ag/${prochaine.first.id}')),
            StatTile(label: d.nav.documents, value: '${(documents.valueOrNull ?? const []).length}', tone: Tone.neutral, hint: d.documents.subtitle, onTap: () => context.push('/documents')),
          ]),
          if (visitesEnAttente.isNotEmpty) ...[
            SectionHeader(d.dash.visitesEnAttente),
            CardList([
              for (final v in visitesEnAttente)
                ListRow(
                  leading: const IconCircle(Icons.meeting_room_rounded, tone: Tone.warn, size: 40),
                  title: fill(d.visites.demandeAcces, {'nom': v.visiteurNom, 'lot': lotsAffiches.where((x) => x.id == v.lotId).firstOrNull?.numero ?? '—'}),
                  subtitle: formatHeure(v.horodatage, l),
                  trailing: StatusBadge(d.visites.autoriser, variant: BadgeVariant.info),
                  onTap: () => context.push('/visites/${v.id}'),
                ),
            ]),
          ],
          if (!locataire) ...[
            SectionHeader(d.dash.prochaineAg),
            _AgCard(ag: prochaine.firstOrNull, resident: true),
          ],
          SectionHeader(d.dash.mesIncidents, actionLabel: d.common.seeAll, onAction: () => context.push('/incidents')),
          mesIncidents.isEmpty ? SuCard(child: Text(d.incidents.aucunIncident, style: t.bodySmall)) : CardList([for (final i in mesIncidents.take(5)) IncidentRow(i)]),
          SectionHeader(d.dash.mesReservations, actionLabel: d.common.seeAll, onAction: () => context.push('/reservations')),
          mesResas.isEmpty
              ? SuCard(child: Text(d.espaces.aucuneReservation, style: t.bodySmall))
              : CardList([
                  for (final r in mesResas)
                    ListRow(leading: const IconCircle(Icons.calendar_month_rounded, tone: Tone.sand, size: 36), title: formatDateHeure(r.dateDebut, l), trailing: StatusBadge(d.enums.statutReservation[r.statut] ?? r.statut, variant: reservationVariant[r.statut] ?? BadgeVariant.neutral), onTap: () => context.push('/reservations')),
                ]),
          if (pvDispo) ...[
            SectionHeader(d.dash.pvDisponibles),
            SuCard(onTap: () => context.push('/documents'), child: Row(children: [const IconCircle(Icons.gavel_rounded, tone: Tone.lilac, size: 40), const SizedBox(width: 12), Expanded(child: Text(d.dash.pvDisponibles, style: t.titleSmall)), const ChevronEnd()])),
          ],
          SectionHeader(d.dash.notificationsRecentes, actionLabel: d.notifs.voirToutes, onAction: () => context.push('/notifications')),
          (notifs.valueOrNull ?? const <NotificationItem>[]).isEmpty
              ? SuCard(child: Text(d.notifs.aucune, style: t.bodySmall))
              : CardList([
                  for (final n in notifs.valueOrNull!.take(4))
                    ListRow(
                      leading: IconCircle(Icons.notifications_rounded, tone: n.lu ? Tone.neutral : Tone.sand, size: 36),
                      title: n.titre ?? n.templateCode,
                      subtitle: formatDateHeure(n.horodatageEnvoi, l),
                      onTap: () => context.push(lienNotification(n.templateCode, n.contenuJson)),
                    ),
                ]),
          DocumentsCard(documents: documents.valueOrNull ?? const []),
        ],
      ),
    );
  }
}

class _SoldeCard extends StatelessWidget {
  const _SoldeCard({required this.lot, required this.du, required this.loading});
  final Lot lot;
  final BigInt du;
  final bool loading;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final aJour = du <= BigInt.zero;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconCircle(Icons.home_rounded, tone: aJour ? Tone.sage : Tone.sand, size: 40),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${d.enums.typeLot[lot.typeLot] ?? lot.typeLot} ${lot.numero}', style: t.titleSmall), Text(aJour ? d.dash.monSoldeAJour : d.dash.soldeDu, style: t.bodySmall)])),
            if (!loading) StatusBadge(aJour ? d.enums.statutLigne['PAYE']! : d.enums.statutLigne['IMPAYE']!, variant: aJour ? BadgeVariant.ok : BadgeVariant.danger),
          ],
        ),
        const SizedBox(height: 12),
        MoneyText(loading ? '…' : formatMAD(versChaine(du), context.locale), style: t.displayLarge?.copyWith(color: aJour ? SuColors.green500 : SuColors.red500)),
        const SizedBox(height: 6),
        Align(alignment: AlignmentDirectional.centerEnd, child: Semantics(label: d.dash.voirDetail, child: const CircleArrow())),
      ],
    );
  }
}

// ── B5 gardien ────────────────────────────────────────────────────────────────
class _DashGardien extends ConsumerWidget {
  const _DashGardien();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final visites = ref.watch(visitesProvider);
    final incidents = ref.watch(incidentsProvider);
    final queue = ref.watch(visitesQueueProvider).valueOrNull ?? const [];
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final all = visites.valueOrNull ?? const <Visite>[];
    final duJour = all.where((v) => estAujourdhui(v.horodatage)).toList();
    final enAttente = all.where((v) => v.statut == 'EN_ATTENTE').toList();
    final ouverts = (incidents.valueOrNull ?? const <Incident>[]).where((i) => i.ouvert).toList();

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(visitesProvider);
        ref.invalidate(incidentsProvider);
        await ref.read(visitesSyncProvider.notifier).flush();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, subtitle: '${d.roles[ctx.role] ?? ctx.role} · ${ctx.copropriete?.nom ?? ''}'),
          PhotoBanner('entree', title: ctx.copropriete?.nom, subtitle: d.roles[ctx.role]),
          SuCard(
            onTap: () => context.push('/visites?enregistrer=1'),
            padding: const EdgeInsets.all(22),
            child: Row(
              children: [
                Container(width: 64, height: 64, decoration: BoxDecoration(color: SuColors.blue600, borderRadius: BorderRadius.circular(SuRadius.row)), child: const Icon(Icons.meeting_room_rounded, color: SuColors.onBrand, size: 30)),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.dash.enregistrerVisiteur, style: t.titleLarge?.copyWith(fontSize: 18)),
                      const SizedBox(height: 4),
                      Text(md.worksOffline, style: t.bodySmall),
                      const SizedBox(height: 8),
                      StatusBadge(online ? md.online : md.offline, variant: online ? BadgeVariant.ok : BadgeVariant.warn, small: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (queue.isNotEmpty) ...[
            const SizedBox(height: 10),
            SuCard(
              border: SuColors.warnBorder,
              onTap: () => context.push('/visites'),
              child: Row(
                children: [
                  const IconCircle(Icons.cloud_upload_rounded, tone: Tone.warn, size: 40),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(fill(md.queueTitle, {'n': queue.length}), style: t.titleSmall), Text(md.queueHint, style: t.bodySmall)])),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          SuCard(
            onTap: () => context.push('/incidents/nouveau'),
            padding: const EdgeInsets.all(22),
            child: Row(children: [
              Container(width: 64, height: 64, decoration: BoxDecoration(color: SuColors.amber500, borderRadius: BorderRadius.circular(SuRadius.row)), child: const Icon(Icons.build_rounded, color: SuColors.onBrand, size: 28)),
              const SizedBox(width: 18),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d.dash.signalerIncident, style: t.titleLarge?.copyWith(fontSize: 18)), const SizedBox(height: 4), Text(d.incidents.titre, style: t.bodySmall)])),
            ]),
          ),
          const SizedBox(height: 10),
          TwoCols([
            StatTile(label: d.visites.duJour, value: '${duJour.length}', tone: Tone.lilac, onTap: () => context.push('/visites')),
            StatTile(label: d.dash.visitesEnAttente, value: '${enAttente.length}', tone: Tone.sand, onTap: () => context.push('/visites')),
          ]),
          SectionHeader(d.dash.visitesEnAttente, actionLabel: d.common.seeAll, onAction: () => context.push('/visites')),
          if (visites.hasError) ErrorState(error: visites.error!, onRetry: () => ref.invalidate(visitesProvider)),
          enAttente.isEmpty
              ? SuCard(child: Text(d.visites.aucuneVisite, style: t.bodySmall))
              : CardList([for (final v in enAttente.take(6)) ListRow(leading: Avatar(v.visiteurNom, size: 36), title: v.visiteurNom, subtitle: formatHeure(v.horodatage, l), trailing: StatusBadge(d.enums.statutVisite['EN_ATTENTE']!, variant: BadgeVariant.warn, pulse: true))]),
          SectionHeader(d.dash.incidentsOuverts, actionLabel: d.common.seeAll, onAction: () => context.push('/incidents')),
          ouverts.isEmpty ? SuCard(child: Text(d.incidents.aucunIncident, style: t.bodySmall)) : CardList([for (final i in ouverts.take(5)) IncidentRow(i)]),
        ],
      ),
    );
  }
}

// ── Prestataire ───────────────────────────────────────────────────────────────
class _DashPrestataire extends ConsumerWidget {
  const _DashPrestataire();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;

    final incidents = ref.watch(incidentsProvider);
    final tickets = incidents.valueOrNull ?? const <Incident>[];
    final ouverts = tickets.where((i) => i.ouvert).toList();
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(incidentsProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, subtitle: d.dash.mesTickets),
          PhotoBanner('cour', title: ctx.copropriete?.nom, subtitle: d.roles[ctx.role]),
          TwoCols([
            StatTile(label: d.dash.mesTickets, value: '${tickets.length}', tone: Tone.sage),
            StatTile(label: d.dash.incidentsOuverts, value: '${ouverts.length}', tone: Tone.sand),
          ]),
          SectionHeader(d.dash.mesTickets),
          AsyncView(incidents, onRetry: () => ref.invalidate(incidentsProvider), data: (list) => list.isEmpty ? EmptyState(title: d.incidents.aucunIncident, hint: d.incidents.aucunIncidentAide, icon: Icons.build_rounded) : CardList([for (final i in list) IncidentRow(i)])),
          const SizedBox(height: 16),
          SuBanner(tone: BannerTone.info, body: md.cloisonnement),
        ],
      ),
    );
  }
}
