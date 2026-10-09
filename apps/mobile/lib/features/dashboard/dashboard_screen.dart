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
import '../../core/util/nav.dart';
import '../../core/util/notifications_link.dart';
import '../../core/util/status.dart';
import '../../core/feel/feel.dart';
import '../../core/widgets/widgets.dart';
import '../../offline/sync_queue/visites_sync.dart';
import '../documents/documents_screen.dart';
import '../communication/communication_screens.dart';
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
      'GESTIONNAIRE_LCD' => const _DashResident(locataire: true),
      _ => const _DashResident(locataire: false),
    };
    return Scaffold(appBar: const ShellHeader(), body: body);
  }
}

/// Haut de l'accueil, d'après l'écran « Account » de Wise : bandeau d'image pleine largeur aux
/// coins supérieurs arrondis (ici la photo de la résidence, personnalisable par le syndic),
/// recouvert par la feuille blanche qui porte le GRAND titre (salutation, prénom en gras).
class _Greeting extends StatelessWidget {
  const _Greeting({required this.ctx, this.subtitle, this.photo = 'accueil'});
  final AppContext ctx;
  final String? subtitle;
  final String photo;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 150,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              PositionedDirectional(
                start: -16,
                end: -16,
                top: 0,
                bottom: 0,
                child: ClipRRect(borderRadius: const BorderRadius.vertical(top: Radius.circular(28)), child: SuHeroDrift(radius: 28, child: SuParallax(child: CoproPhoto(photo)))),
              ),
              const PositionedDirectional(
                start: -16,
                end: -16,
                bottom: -1,
                height: 30,
                child: DecoratedBox(decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(28)))),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Salutation révélée mot par mot, prénom en gras (comme le tableau de bord web).
              Builder(builder: (context) {
                // Vivant : salutation selon le moment de la journée (Bonjour / Bon après-midi / Bonsoir).
                final salut = Feel.alive ? greetingFor(context, DateTime.now()) : fill(d.dash.greeting, {'prenom': ''}).trim();
                final nom = '${ctx.profil.prenom ?? nomCompletProfil(ctx) ?? ''}!';
                return SuRevealText('$salut $nom', style: t.displayLarge?.copyWith(fontWeight: FontWeight.w500), boldFrom: salut.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length);
              }),
              if (subtitle != null) SuEnter(index: 3, child: Padding(padding: const EdgeInsets.only(top: 6), child: Text(subtitle!, style: t.bodyLarge?.copyWith(color: SuColors.soft)))),
            ],
          ),
        ),
      ],
    );
  }
}

/// Bouton d'action rond de Wise (« Send », « Add money », « Request ») : disque greige, glyphe
/// encre, libellé gras dessous. Le premier peut être plein (sauge) : l'action principale.
class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.label, required this.onTap, this.primary = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: SuTap(
            onTap: onTap,
            ink: false,
            scale: 1,
            child: Column(
              children: [
                SuPressable(
                  scale: 0.9,
                  child: Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(color: primary ? SuColors.cta : SuColors.tile, shape: BoxShape.circle),
                    child: Icon(icon, size: 26, color: SuColors.ink),
                  ),
                ),
                const SizedBox(height: 8),
                Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.labelMedium?.copyWith(fontSize: 13, color: SuColors.ink, height: 1.25)),
              ],
            ),
          ),
        ),
      );
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

    return SuRefresh(
      onRefresh: refresh,
      child: rememberTabScroll(context, '/tableau-de-bord', (key) => ListView(
        key: key,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, subtitle: lectureSeule ? d.dash.controleTitle : ctx.copropriete?.nom),
          if (synthese.hasError) ErrorState(error: synthese.error!, onRetry: refresh),
          // M24 — checklist de démarrage (lecture) : visible tant que tout n'est pas en place.
          const OnboardingCard(),
          // Soldes Wise : tuiles greige glissables, grand chiffre en bas.
          TileCarousel(height: 208, children: [
            StatTile(icon: Icons.payments_rounded, label: d.dash.impayes, value: synthese.isLoading ? '…' : formatMAD(versChaine(tot.impaye), l), tone: Tone.sage, onTap: () => context.push('/finances/appels-de-fonds')),
            StatTile(icon: Icons.insights_rounded, label: d.finances.tauxPaiement, value: synthese.isLoading ? '…' : formatPourcent(tot.taux), tone: Tone.lilac, hint: d.dash.recouvrementHint, onTap: () => context.push('/finances/appels-de-fonds')),
            StatTile(icon: Icons.build_rounded, label: d.dash.incidentsOuverts, value: '${ouverts.length}', tone: Tone.sand, hint: sla.isNotEmpty ? '${sla.length} · ${d.dash.slaDepasse}' : null, hintColor: sla.isNotEmpty ? SuColors.danger : null, onTap: () => context.push('/incidents')),
            StatTile(icon: Icons.apartment_rounded, label: d.nav.lots, value: '${lots.valueOrNull?.length ?? '…'}', tone: Tone.tosca, hint: '${(lots.valueOrNull ?? const <Lot>[]).where((x) => x.statut == 'OCCUPE').length} ${(d.enums.statutLot['OCCUPE'] ?? '').toLowerCase()}', onTap: () => context.push('/lots')),
            StatTile(icon: Icons.event_available_rounded, label: d.dash.reservationsAValider, value: '${aValider.length}', tone: Tone.neutral, onTap: () => context.push('/reservations')),
          ]),
          // Moment signature 6 : toute la résidence à jour → anneau plein, halo une fois par mois.
          if (!synthese.isLoading && tot.impaye == BigInt.zero && tot.taux >= 1) _ResidenceAJour(coproId: ctx.coproprieteId),
          if (!lectureSeule) ...[
            const SizedBox(height: 22),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _RoundAction(primary: true, icon: Icons.payments_rounded, label: d.finances.enregistrerPaiement, onTap: () => context.push('/finances/appels-de-fonds')),
                _RoundAction(icon: Icons.request_quote_rounded, label: d.dash.genererAppel, onTap: () => context.push('/finances/appels-de-fonds?generer=1')),
                _RoundAction(icon: Icons.vpn_key_rounded, label: d.dash.inviterResident, onTap: () => context.push('/invitations?nouvelle=1')),
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
                      decoration: BoxDecoration(color: SuColors.surface, borderRadius: BorderRadius.circular(16)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.enums.escalade[n.niveau] ?? n.niveau, style: t.labelSmall?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w700)),
                          AnimatedAmount(versChaine(n.montant), style: t.bodySmall?.copyWith(color: SuColors.danger, fontWeight: FontWeight.w600), textDirection: TextDirection.ltr, maxLines: null, upIsGood: false),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          SectionHeader(d.finances.appels, subtitle: d.finances.appelsSubtitle, actionLabel: d.common.seeAll, onAction: () => context.push('/finances/appels-de-fonds')),
          if (s.appels.isEmpty)
            EmptyState(title: d.finances.aucunAppel, hint: d.finances.aucunAppelAide, icon: Icons.request_quote_rounded, illustration: 'empty-appels', actionLabel: lectureSeule ? null : d.finances.genererAppel, onAction: () => context.push('/finances/appels-de-fonds?generer=1'))
          else
            CardList([
              for (final a in s.appels.take(5))
                ListRow(
                  key: ValueKey(a.id),
                  leading: const IconCircle(Icons.request_quote_rounded, tone: Tone.sand),
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
            _EmptyLine(d.incidents.aucunIncident, icon: Icons.build_rounded)
          else
            CardList([for (final i in ouverts.take(5)) IncidentRow(i, key: ValueKey(i.id))]),
          SectionHeader(d.dash.prochaineAg),
          _AgCard(ag: prochaine.firstOrNull, creer: lectureSeule ? null : () => context.push('/ag/nouvelle')),
          SectionHeader(lectureSeule ? d.dash.litigesOuverts : d.dash.reservationsAValider, actionLabel: d.common.seeAll, onAction: () => context.push(lectureSeule ? '/litiges' : '/reservations')),
          if (lectureSeule)
            litigesOuverts.isEmpty
                ? _EmptyLine(d.litiges.aucun, icon: Icons.gavel_rounded)
                : CardList([for (final x in litigesOuverts.take(4)) ListRow(key: ValueKey(x.id), leading: const IconCircle(Icons.gavel_rounded, tone: Tone.lilac), title: x.type, subtitle: d.enums.escaladeLitige['${x.escaladeNiveau}'], onTap: () => context.push('/litiges'))])
          else
            aValider.isEmpty
                ? _EmptyLine(d.espaces.aucuneReservation, icon: Icons.event_available_rounded)
                : CardList([
                    for (final r in aValider.take(4))
                      ListRow(key: ValueKey(r.id), leading: const IconCircle(Icons.calendar_month_rounded, tone: Tone.tosca), title: formatDateHeure(r.dateDebut, l), trailing: StatusBadge(d.enums.statutReservation['EN_ATTENTE']!, variant: BadgeVariant.warn, pulse: true), onTap: () => context.push('/reservations')),
                  ]),
          DocumentsCard(documents: documents.valueOrNull ?? const []),
        ],
      )),
    );
  }
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
            Expanded(child: Text(d.dash.aucuneAg, style: t.bodyMedium?.copyWith(color: SuColors.soft))),
            if (creer != null) SuButton(variant: SuButtonVariant.ghost, onPressed: creer, label: d.dash.creerAg),
          ],
        ),
      );
    }
    // Carte-affiche Wise : salle sombre, date en capitales d'affiche, échéance relative.
    final rel = echeanceRelative(context, a.dateAg);
    return PosterCard(
      art: 'poster-ag',
      onTap: () => context.push('/ag/${a.id}'),
      kicker: '${d.enums.typeAg[a.type] ?? a.type}${rel.isEmpty ? '' : ' · $rel'}',
      title: formatDateLongue(a.dateAg, context.locale),
      body: [
        d.enums.statutAg[a.statut] ?? a.statut,
        if (a.resolutions.isNotEmpty) '${a.resolutions.length} ${d.ag.resolutions.toLowerCase()}',
      ].join(' · '),
      ctaLabel: resident && a.statut == 'EN_COURS' ? d.ag.rejoindreSeance : resident && a.statut == 'CONVOQUEE' ? d.dash.donnerProcuration : null,
      onCta: resident && a.statut == 'EN_COURS' ? () => context.push('/ag/${a.id}/seance') : null,
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
      leading: IconCircle(Icons.build_rounded, tone: i.slaDepasse ? Tone.danger : Tone.tosca),
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
    final lots = ref.watch(lotsProvider);
    final synthese = locataire ? null : ref.watch(syntheseProvider);
    final ags = locataire ? null : ref.watch(agListProvider);
    final incidents = ref.watch(incidentsProvider);
    final reservations = ref.watch(reservationsProvider);
    final visites = ref.watch(visitesProvider);
    final notifs = ref.watch(notificationsProvider);
    final documents = ref.watch(documentsProvider);
    // M21 : dernières annonces du tableau d'affichage + non lues.
    final annonces = ref.watch(annoncesProvider(null)).valueOrNull ?? const <Annonce>[];
    final annoncesNonLues = ref.watch(annoncesNonLuesProvider).valueOrNull ?? 0;
    // M15 : séjours LCD (propriétaires, gestionnaire) — liste vide pour les autres.
    final sejoursLcd = ctx.declareSejoursLcd ? (ref.watch(lcdSejoursProvider).valueOrNull ?? const <LcdSejour>[]) : const <LcdSejour>[];

    Future<void> refresh() async {
      ref.invalidate(lotsProvider);
      if (ctx.declareSejoursLcd) ref.invalidate(lcdSejoursProvider);
      ref.invalidate(syntheseProvider);
      ref.invalidate(agListProvider);
      ref.invalidate(incidentsProvider);
      ref.invalidate(reservationsProvider);
      ref.invalidate(visitesProvider);
      ref.invalidate(notificationsProvider);
      ref.invalidate(documentsProvider);
      ref.invalidate(annoncesProvider);
      ref.invalidate(annoncesNonLuesProvider);
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
    // Affiche « Où va mon argent » quand aucune affiche d'AG n'est montrée (liste des AG chargée),
    // si la navigation du rôle expose la transparence.
    final voitTransparence = buildNav(ctx, d).expand((s) => s.items).any((i) => i.path == '/rapports/transparence');
    final afficheTransparence = voitTransparence && prochaine.isEmpty && (locataire || (ags?.hasValue ?? false));

    return SuRefresh(
      onRefresh: refresh,
      child: rememberTabScroll(context, '/tableau-de-bord', (key) => ListView(
        key: key,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, subtitle: '${libelleRole(context, ctx.role)}${mesLots.isNotEmpty ? ' · ${mesLots.map((x) => x.numero).join(', ')}' : ''}'),
          TileCarousel(height: 196, children: [
            if (!locataire) StatTile(icon: Icons.account_balance_wallet_rounded, label: d.dash.monSolde, value: synthese?.isLoading ?? false ? '…' : formatMAD(versChaine(totalDu), l), tone: totalDu > BigInt.zero ? Tone.danger : Tone.ok, onTap: lotsAffiches.length == 1 ? () => context.push('/lots/${lotsAffiches.first.id}?onglet=finances') : () => context.push('/lots')),
            StatTile(icon: Icons.home_rounded, label: d.lots.mesLots, value: '${lotsAffiches.length}', tone: Tone.sage, onTap: () => context.push('/lots')),
            StatTile(icon: Icons.build_rounded, label: d.nav.incidents, value: '${mesIncidents.length}', tone: Tone.sand, onTap: () => context.push('/incidents')),
            StatTile(icon: Icons.event_available_rounded, label: d.dash.mesReservations, value: '${mesResas.length}', tone: Tone.lilac, onTap: () => context.push('/reservations')),
            if (ctx.declareSejoursLcd) StatTile(icon: Icons.luggage_rounded, label: d.lcd.titre, value: '${sejoursLcd.where((s) => s.actif).length}', tone: Tone.tosca, onTap: () => context.push('/location-courte-duree')),
            StatTile(icon: Icons.description_rounded, label: d.nav.documents, value: '${(documents.valueOrNull ?? const []).length}', tone: Tone.neutral, onTap: () => context.push('/documents')),
          ]),
          const SizedBox(height: 22),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!locataire) _RoundAction(primary: true, icon: Icons.account_balance_rounded, label: d.justificatifs.payerTitre, onTap: () => context.push('/payer')),
              _RoundAction(primary: locataire, icon: Icons.build_rounded, label: d.dash.signalerIncident, onTap: () => context.push('/incidents/nouveau')),
              if (ctx.role != 'GESTIONNAIRE_LCD') _RoundAction(icon: Icons.event_available_rounded, label: d.espaces.reserver, onTap: () => context.push('/espaces-communs')),
              if (locataire && ctx.declareSejoursLcd) _RoundAction(icon: Icons.luggage_rounded, label: d.lcd.declarerSejour, onTap: () => context.push('/location-courte-duree/sejours/nouveau')),
            ],
          ),
          if (!locataire) ...[
            if (synthese!.hasError) ErrorState(error: synthese.error!, onRetry: refresh),
            SectionHeader(d.dash.monSolde, subtitle: '${d.dash.payerEnLigne} · ${d.dash.bientotDisponible}'),
            for (final lot in lotsAffiches)
              SuCard(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
                onTap: () => context.push('/lots/${lot.id}?onglet=finances'),
                child: _SoldeCard(lot: lot, du: soldes[lot.id] ?? BigInt.zero, loading: synthese.isLoading),
              ),
            if (lotsAffiches.isEmpty && !lots.isLoading) _EmptyLine(d.lots.aucunLot, icon: Icons.home_rounded),
          ] else ...[
            SuBanner(tone: BannerTone.info, title: md.noFinancesTitle, body: md.noFinancesBody),
          ],
          SectionHeader(d.communication.titre, subtitle: annoncesNonLues > 0 ? fill(d.communication.nonLues, {'n': '$annoncesNonLues'}) : null, actionLabel: d.common.seeAll, onAction: () => context.push('/affichage')),
          if (annonces.isEmpty) _EmptyLine(d.communication.aucune, icon: Icons.campaign_rounded) else for (final a in annonces.take(3)) Padding(padding: const EdgeInsets.only(bottom: 10), child: AnnonceCard(a)),
          if (visitesEnAttente.isNotEmpty) ...[
            SectionHeader(d.dash.visitesEnAttente),
            CardList([
              for (final v in visitesEnAttente)
                ListRow(
                  key: ValueKey(v.id),
                  leading: const IconCircle(Icons.meeting_room_rounded, tone: Tone.warn),
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
          if (afficheTransparence)
            Padding(
              padding: EdgeInsets.only(top: locataire ? 30 : 12),
              child: PosterCard(
                art: 'poster-transparence',
                title: d.rapports.transparenceTitre,
                body: d.rapports.transparenceSubtitle,
                ctaLabel: d.common.see,
                onTap: () => context.push('/rapports/transparence'),
              ),
            ),
          SectionHeader(d.dash.mesIncidents, actionLabel: d.common.seeAll, onAction: () => context.push('/incidents')),
          mesIncidents.isEmpty ? _EmptyLine(d.incidents.aucunIncident, icon: Icons.build_rounded) : CardList([for (final i in mesIncidents.take(5)) IncidentRow(i, key: ValueKey(i.id))]),
          SectionHeader(d.dash.mesReservations, actionLabel: d.common.seeAll, onAction: () => context.push('/reservations')),
          mesResas.isEmpty
              ? _EmptyLine(d.espaces.aucuneReservation, icon: Icons.event_available_rounded)
              : CardList([
                  for (final r in mesResas)
                    ListRow(key: ValueKey(r.id), leading: const IconCircle(Icons.calendar_month_rounded, tone: Tone.sand), title: formatDateHeure(r.dateDebut, l), trailing: StatusBadge(d.enums.statutReservation[r.statut] ?? r.statut, variant: reservationVariant[r.statut] ?? BadgeVariant.neutral), onTap: () => context.push('/reservations')),
                ]),
          if (pvDispo) ...[
            SectionHeader(d.dash.pvDisponibles),
            CardList([ListRow(leading: const IconCircle(Icons.gavel_rounded, tone: Tone.lilac), title: d.dash.pvDisponibles, onTap: () => context.push('/documents'))]),
          ],
          SectionHeader(d.dash.notificationsRecentes, actionLabel: d.notifs.voirToutes, onAction: () => context.push('/notifications')),
          (notifs.valueOrNull ?? const <NotificationItem>[]).isEmpty
              ? _EmptyLine(d.notifs.aucune, icon: Icons.notifications_none_rounded)
              : CardList([
                  for (final n in notifs.valueOrNull!.take(4))
                    ListRow(
                      key: ValueKey(n.id),
                      leading: IconCircle(Icons.notifications_rounded, tone: n.lu ? Tone.neutral : Tone.sand),
                      title: n.titre ?? n.templateCode,
                      subtitle: formatDateHeure(n.horodatageEnvoi, l),
                      onTap: () => context.push(lienNotification(n.templateCode, n.contenuJson)),
                    ),
                ]),
          DocumentsCard(documents: documents.valueOrNull ?? const []),
        ],
      )),
    );
  }
}

/// Bloc de solde Wise (« Australian Dollar · 1 234,56 ») : lot en tête avec sa pastille et son
/// statut, grand montant gras, libellé et chevron de détail dessous.
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
            IconCircle(Icons.home_rounded, tone: aJour ? Tone.sage : Tone.sand, size: 40, iconSize: 20),
            const SizedBox(width: 12),
            Expanded(child: Text('${d.enums.typeLot[lot.typeLot] ?? lot.typeLot} ${lot.numero}', style: t.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis)),
            if (!loading) StatusBadge(aJour ? d.enums.statutLigne['PAYE']! : d.enums.statutLigne['IMPAYE']!, variant: aJour ? BadgeVariant.ok : BadgeVariant.danger, small: true),
          ],
        ),
        const SizedBox(height: 26),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: AlignmentDirectional.centerStart,
          child: loading ? Text('…', style: t.displayLarge) : AnimatedDigits(formatMAD(versChaine(du), context.locale), style: t.displayLarge?.copyWith(fontSize: 38, color: aJour ? SuColors.ink : SuColors.danger)),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Expanded(child: Text(aJour ? d.dash.monSoldeAJour : d.dash.soldeDu, style: t.bodyMedium?.copyWith(color: SuColors.soft))),
            Semantics(label: d.dash.voirDetail, child: const ChevronEnd()),
          ],
        ),
      ],
    );
  }
}

/// Section vide compacte (petites sections de l'accueil) : pastille voile d'encre et ligne
/// ardoise, alignées comme une ligne de liste — jamais une tuile grise de texte.
class _EmptyLine extends StatelessWidget {
  const _EmptyLine(this.text, {required this.icon});
  final String text;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            IconCircle(icon, tone: Tone.neutral),
            const SizedBox(width: 14),
            Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft))),
          ],
        ),
      );
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

    return SuRefresh(
      onRefresh: () async {
        ref.invalidate(visitesProvider);
        ref.invalidate(incidentsProvider);
        await ref.read(visitesSyncProvider.notifier).flush();
      },
      child: rememberTabScroll(context, '/tableau-de-bord', (key) => ListView(
        key: key,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, photo: 'entree', subtitle: '${libelleRole(context, ctx.role)} · ${ctx.copropriete?.nom ?? ''}'),
          SuCard(
            onTap: () => context.push('/visites?enregistrer=1'),
            color: SuColors.ink,
            radius: 28,
            padding: const EdgeInsets.all(22),
            child: Row(
              children: [
                Container(width: 64, height: 64, decoration: const BoxDecoration(color: SuColors.cta, shape: BoxShape.circle), child: const Icon(Icons.meeting_room_rounded, color: SuColors.ink, size: 30)),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.dash.enregistrerVisiteur, style: t.headlineSmall?.copyWith(color: Colors.white)),
                      const SizedBox(height: 4),
                      Text(md.worksOffline, style: t.bodySmall?.copyWith(color: Colors.white70)),
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
            // File d'envoi hors ligne : tuile plate teintée ambre (pas de liseré).
            SuCard(
              color: SuColors.warnTint,
              onTap: () => context.push('/visites'),
              child: Row(
                children: [
                  const IconCircle(Icons.cloud_upload_rounded, tone: Tone.warn),
                  const SizedBox(width: 14),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(fill(md.queueTitle, {'n': queue.length}), style: t.titleMedium), const SizedBox(height: 2), Text(md.queueHint, style: t.bodySmall)])),
                  const ChevronEnd(),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          SuCard(
            onTap: () => context.push('/incidents/nouveau'),
            padding: const EdgeInsets.all(22),
            child: Row(children: [
              Container(width: 64, height: 64, decoration: const BoxDecoration(color: SuColors.sandMid, shape: BoxShape.circle), child: const Icon(Icons.build_rounded, color: SuColors.ink, size: 28)),
              const SizedBox(width: 18),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d.dash.signalerIncident, style: t.headlineSmall), const SizedBox(height: 4), Text(d.incidents.titre, style: t.bodySmall)])),
              const ChevronEnd(),
            ]),
          ),
          const SizedBox(height: 10),
          TwoCols([
            StatTile(icon: Icons.today_rounded, label: d.visites.duJour, value: '${duJour.length}', tone: Tone.lilac, onTap: () => context.push('/visites')),
            StatTile(icon: Icons.hourglass_top_rounded, label: d.dash.visitesEnAttente, value: '${enAttente.length}', tone: Tone.sand, onTap: () => context.push('/visites')),
          ]),
          SectionHeader(d.dash.visitesEnAttente, actionLabel: d.common.seeAll, onAction: () => context.push('/visites')),
          if (visites.hasError) ErrorState(error: visites.error!, onRetry: () => ref.invalidate(visitesProvider)),
          enAttente.isEmpty
              ? _EmptyLine(d.visites.aucuneVisite, icon: Icons.meeting_room_rounded)
              : CardList([for (final v in enAttente.take(6)) ListRow(key: ValueKey(v.id), leading: Avatar(v.visiteurNom, size: 48), title: v.visiteurNom, subtitle: formatHeure(v.horodatage, l), trailing: StatusBadge(d.enums.statutVisite['EN_ATTENTE']!, variant: BadgeVariant.warn, pulse: true))]),
          SectionHeader(d.dash.incidentsOuverts, actionLabel: d.common.seeAll, onAction: () => context.push('/incidents')),
          ouverts.isEmpty ? _EmptyLine(d.incidents.aucunIncident, icon: Icons.build_rounded) : CardList([for (final i in ouverts.take(5)) IncidentRow(i, key: ValueKey(i.id))]),
        ],
      )),
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
    return SuRefresh(
      onRefresh: () async => ref.invalidate(incidentsProvider),
      child: rememberTabScroll(context, '/tableau-de-bord', (key) => ListView(
        key: key,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          _Greeting(ctx: ctx, photo: 'cour', subtitle: '${libelleRole(context, ctx.role)} · ${ctx.copropriete?.nom ?? ''}'),
          TwoCols([
            StatTile(icon: Icons.confirmation_number_rounded, label: d.dash.mesTickets, value: '${tickets.length}', tone: Tone.sage),
            StatTile(icon: Icons.build_rounded, label: d.dash.incidentsOuverts, value: '${ouverts.length}', tone: Tone.sand),
          ]),
          SectionHeader(d.dash.mesTickets),
          AsyncView(incidents, onRetry: () => ref.invalidate(incidentsProvider), data: (list) => list.isEmpty ? EmptyState(title: d.incidents.aucunIncident, hint: d.incidents.aucunIncidentAide, icon: Icons.build_rounded, illustration: 'empty-incidents') : CardList([for (final i in list) IncidentRow(i, key: ValueKey(i.id))])),
          const SizedBox(height: 16),
          SuBanner(tone: BannerTone.info, body: md.cloisonnement),
        ],
      )),
    );
  }
}

/// M24 — checklist de démarrage de la résidence (lecture seule sur mobile : l'import se fait sur le web).
class OnboardingCard extends ConsumerWidget {
  const OnboardingCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = d.importation;
    final tt = Theme.of(context).textTheme;
    final c = ref.watch(onboardingProvider).valueOrNull;
    if (c == null || c.complet) return const SizedBox.shrink();
    String libelle(String cle) => switch (cle) {
          'residence_creee' => t.etapesOnboarding.residence_creee,
          'lots_importes' => t.etapesOnboarding.lots_importes,
          'tantiemes_coherents' => t.etapesOnboarding.tantiemes_coherents,
          'proprietaires_invites' => t.etapesOnboarding.proprietaires_invites,
          'acceptes' => t.etapesOnboarding.acceptes,
          'budget_actif' => t.etapesOnboarding.budget_actif,
          'premier_appel' => t.etapesOnboarding.premier_appel,
          'rib_saisi' => t.etapesOnboarding.rib_saisi,
          'assurance_saisie' => t.etapesOnboarding.assurance_saisie,
          'gardien_cree' => t.etapesOnboarding.gardien_cree,
          _ => cle,
        };
    // Carte de mise en route Wise (« Finish setting up your account ») : titre gras, compteur,
    // jauge pleine, puis uniquement les étapes restantes (le compteur dit le reste).
    final restantes = c.etapes.where((e) => !e.fait).toList();
    // Bande d'affiche « poster-onboarding » en tête (coins supérieurs arrondis, miroir RTL).
    return SuCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (SuIllustration.has('poster-onboarding'))
          const ClipRRect(borderRadius: BorderRadius.vertical(top: Radius.circular(SuRadius.card)), child: PosterArt('poster-onboarding', height: 120)),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text(t.onboarding, style: tt.headlineSmall)),
              const SizedBox(width: 10),
              StatusBadge(fill(t.progressionOnboarding, {'faites': c.faites, 'total': c.total}), variant: BadgeVariant.info, small: true),
            ]),
            const SizedBox(height: 6),
            Text(c.estDemo ? t.demo : t.onboardingAide, style: tt.bodyMedium?.copyWith(color: SuColors.soft)),
            const SizedBox(height: 14),
            Gauge(c.progression / 100, color: SuColors.link),
            const SizedBox(height: 8),
            for (final e in restantes)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                // Détail court (« 0/3 ») à la fin ; détail long sous le libellé, pour ne pas l'écraser.
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Padding(padding: EdgeInsets.only(top: 1), child: Icon(Icons.radio_button_unchecked_rounded, size: 20, color: SuColors.link)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(libelle(e.cle), style: tt.bodyMedium?.copyWith(color: SuColors.ink)),
                      if (e.detail != null && e.detail!.length > 9) Padding(padding: const EdgeInsets.only(top: 2), child: Text(e.detail!, style: tt.labelSmall)),
                    ]),
                  ),
                  if (e.detail != null && e.detail!.length <= 9) Padding(padding: const EdgeInsetsDirectional.only(start: 8), child: Text(e.detail!, style: tt.labelSmall, textDirection: TextDirection.ltr)),
                ]),
              ),
          ]),
        ),
      ]),
    );
  }
}


/// Résidence 100 % à jour : anneau plein et halo retenu, joué une seule fois par mois et par
/// résidence (puis l'anneau reste plein, immobile).
class _ResidenceAJour extends StatefulWidget {
  const _ResidenceAJour({required this.coproId});
  final String coproId;
  @override
  State<_ResidenceAJour> createState() => _ResidenceAJourState();
}

class _ResidenceAJourState extends State<_ResidenceAJour> {
  bool _glow = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final periode = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    SuSignature.oncePerPeriod('residence-a-jour:${widget.coproId}:$periode').then((first) {
      if (!mounted || !first) return;
      setState(() => _glow = true);
      Haptics.success();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: SuCard(
        child: Row(
          children: [
            SuRing(1, size: 52, stroke: 6, glow: _glow, child: const Icon(Icons.verified_rounded, color: SuColors.ok, size: 24)),
            const SizedBox(width: 14),
            Expanded(child: Text(context.dict.alive.residenceAJour, style: t.titleMedium)),
          ],
        ),
      ),
    );
  }
}
