import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../taches/taches_screens.dart';
import '../documents/document_viewer_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../../core/theme/motion.dart';

// ── E1 Liste ──────────────────────────────────────────────────────────────────
class AgListScreen extends ConsumerWidget {
  const AgListScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final ags = ref.watch(agListProvider);
    return SuPage(
      title: d.ag.titre,
      onRefresh: () async => ref.invalidate(agListProvider),
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => context.push('/ag/nouvelle'), icon: const Icon(Icons.add_rounded), label: Text(d.ag.creer)) : null,
      children: [
        PhotoBanner('salle', title: ctx.copropriete?.nom),
        AsyncView(ags, onRetry: () => ref.invalidate(agListProvider), data: (list) {
          if (list.isEmpty) return EmptyState(title: d.ag.aucuneAg, hint: ctx.isGestion ? d.ag.aucuneAgAide : null, icon: Icons.how_to_vote_rounded, illustration: 'empty-ag');
          final sorted = [...list]..sort((a, b) => b.dateAg.compareTo(a.dateAg));
          return CardList([
            for (final a in sorted)
              ListRow(
                leading: IconCircle(Icons.how_to_vote_rounded, tone: a.statut == 'EN_COURS' ? Tone.warn : a.statut == 'ANNULEE' ? Tone.neutral : Tone.lilac),
                title: d.enums.typeAg[a.type] ?? a.type,
                subtitle: '${formatDateLongue(a.dateAg, l)}${a.quorumAtteint != null ? ' · ${d.ag.quorum} ${formatPourcent(double.tryParse(a.quorumAtteint!))}' : ''}',
                trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [StatusBadge(d.enums.statutAg[a.statut] ?? a.statut, variant: agVariant[a.statut] ?? BadgeVariant.neutral, small: true, pulse: a.statut == 'EN_COURS'), if (a.aVenir) Padding(padding: const EdgeInsets.only(top: 4), child: Text(echeanceRelative(context, a.dateAg), style: t.labelSmall))]),
                onTap: () => context.push('/ag/${a.id}'),
              ),
          ]);
        }),
      ],
    );
  }
}

// ── E2 Créer ──────────────────────────────────────────────────────────────────
class AgFormScreen extends ConsumerStatefulWidget {
  const AgFormScreen({super.key});
  @override
  ConsumerState<AgFormScreen> createState() => _AgFormScreenState();
}

class _AgFormScreenState extends ConsumerState<AgFormScreen> {
  String _type = 'ORDINAIRE';
  DateTime _date = DateTime.now().add(const Duration(days: 30)).copyWith(hour: 18, minute: 30, second: 0, millisecond: 0);
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return SuPage(
      title: d.ag.nouvelleTitre,
      children: [
        SuSelect<String>(label: d.ag.type, value: _type, options: d.enums.typeAg.keys.toList(), labelOf: (v) => d.enums.typeAg[v]!, onChanged: (v) => setState(() => _type = v), required: true),
        const SizedBox(height: 12),
        Text(d.ag.date, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 8),
        // Tuile Wise : pastille, date en gras, chevron — un tap ouvre date puis heure.
        SuCard(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 10, 12),
          onTap: () async {
            final day = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 730)));
            if (day == null || !context.mounted) return;
            final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_date));
            setState(() => _date = DateTime(day.year, day.month, day.day, time?.hour ?? 18, time?.minute ?? 30));
          },
          child: Row(
            children: [
              const IconCircle(Icons.event_rounded),
              const SizedBox(width: 14),
              Expanded(child: Text(formatDateLongue(_date.toIso8601String(), context.locale), style: t.titleMedium)),
              const ChevronEnd(),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SuBanner(tone: BannerTone.info, body: d.ag.convoquerAide),
        const SizedBox(height: 20),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.ag.creer,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<AssembleeGenerale>('/ag', body: {'type': _type, 'date_ag': _date.toUtc().toIso8601String()}, parse: (j) => AssembleeGenerale.fromJson(asMap(j)));
            if (!context.mounted) return;
            switch (r) {
              case ApiOk<AssembleeGenerale>(:final data):
                ref.invalidate(agListProvider);
                // Succès plein écran posé sur la fiche (contexte racine : ce formulaire est remplacé).
                final root = Navigator.of(context, rootNavigator: true).context;
                final resume = '${d.enums.typeAg[_type] ?? _type} · ${formatDateLongue(_date.toIso8601String(), context.locale)}';
                context.pushReplacement('/ag/${data.id}');
                showSuccess(root, title: d.ag.nouvelleTitre, body: resume, illustration: 'ok-general');
              case ApiFail<AssembleeGenerale>():
                setState(() {
                  _loading = false;
                  _fail = r;
                });
            }
          },
        ),
      ],
    );
  }
}

// ── E3 / E4 Détail ────────────────────────────────────────────────────────────
class AgDetailScreen extends ConsumerWidget {
  const AgDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final ag = ref.watch(agProvider(id));
    final procurations = ref.watch(agProcurationsProvider(id));
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final membres = annuaireDepuisLots(lots);
    void refresh() {
      ref.invalidate(agProvider(id));
      ref.invalidate(agProcurationsProvider(id));
      ref.invalidate(agListProvider);
    }

    return SuPage(
      title: ag.valueOrNull == null ? d.ag.titre : (d.enums.typeAg[ag.valueOrNull!.type] ?? ag.valueOrNull!.type),
      subtitle: ag.valueOrNull == null ? null : formatDateLongue(ag.valueOrNull!.dateAg, l),
      onRefresh: () async => refresh(),
      children: [
        AsyncView(ag, onRetry: refresh, data: (a) {
          final procs = (procurations.valueOrNull ?? const <AgProcuration>[]).where((p) => p.active).toList();
          final mesLots = lots.where((x) => x.estProprietaire(ctx.profil.id)).toList();
          final mesProcs = procs.where((p) => p.mandantId == ctx.profil.id).toList();
          final recues = procs.where((p) => p.mandataireId == ctx.profil.id).toList();
          final resolutions = [...a.resolutions]..sort((x, y) => x.ordre.compareTo(y.ordre));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Bloc de synthèse Wise : grande pastille, statut, échéance en gros, quorum.
              SuCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        IconCircle(Icons.how_to_vote_rounded, tone: a.statut == 'EN_COURS' ? Tone.warn : a.statut == 'ANNULEE' ? Tone.neutral : Tone.lilac, size: 56),
                        const Spacer(),
                        StatusBadge(d.enums.statutAg[a.statut] ?? a.statut, variant: agVariant[a.statut] ?? BadgeVariant.neutral, pulse: a.statut == 'EN_COURS'),
                      ],
                    ),
                    const SizedBox(height: 18),
                    // La date longue est déjà sous le grand titre de la page : ici, l'échéance relative.
                    if (a.aVenir && echeanceRelative(context, a.dateAg).isNotEmpty) Text(echeanceRelative(context, a.dateAg), style: t.displaySmall),
                    if (a.dateConvocation != null) Padding(padding: const EdgeInsets.only(top: 4), child:Text(fill(d.ag.convocationEnvoyeeLe, {'date': formatDateCourte(a.dateConvocation, l)}), style: t.bodyMedium?.copyWith(color: SuColors.soft))),
                    if (a.quorumAtteint != null || a.quorumRequis != null) ...[
                      const SizedBox(height: 16),
                      Text(d.ag.quorum, style: t.labelMedium?.copyWith(color: SuColors.soft)),
                      const SizedBox(height: 2),
                      if (a.quorumAtteint != null) Text(formatPourcent(double.tryParse(a.quorumAtteint!)), style: t.displaySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]), textDirection: TextDirection.ltr),
                      if (a.quorumRequis != null) Text(fill(d.ag.quorumRequis, {'val': formatPourcent(double.tryParse(a.quorumRequis!))}), style: t.bodyMedium?.copyWith(color: SuColors.soft)),
                    ],
                    if (a.statut == 'ANNULEE' && a.motifAnnulation != null) Padding(padding: const EdgeInsets.only(top: 14), child: SuBanner(tone: BannerTone.warn, title: d.ag.motifAnnulation, body: a.motifAnnulation!)),
                  ],
                ),
              ),
              // Compte à rebours (affiche encre) — le seul moment sombre de l'écran convoqué.
              if (a.statut == 'CONVOQUEE') Padding(padding: const EdgeInsets.only(top: 12), child: _Countdown(a.dateAg)),
              if (a.statut == 'EN_COURS') ...[
                const SizedBox(height: 12),
                PosterCard(
                  kicker: d.enums.typeAg[a.type] ?? a.type,
                  title: md.seanceEnCours,
                  body: '${resolutions.length} ${d.ag.resolutions.toLowerCase()}',
                  ctaLabel: ctx.isGestion ? d.ag.pupitre : d.ag.rejoindreSeance,
                  onTap: () => context.push('/ag/$id/seance'),
                ),
              ],
              if (a.statut == 'CLOTUREE') ...[
                const SizedBox(height: 12),
                FilledButton.icon(onPressed: () => context.push('/ag/$id/pv'), icon: const Icon(Icons.gavel_rounded), label: Text(d.ag.pv)),
              ],
              SectionHeader(d.ag.resolutions, subtitle: '${resolutions.length} ${d.ag.resolutions.toLowerCase()}', actionLabel: ctx.isGestion && a.statut == 'PLANIFIEE' ? d.ag.ajouterResolution : null, onAction: () => _ajouterResolution(context, ref, a)),
              if (resolutions.isEmpty)
                EmptyState(title: d.ag.aucuneResolution, hint: ctx.isGestion ? d.ag.aucuneResolutionAide : null, icon: Icons.list_alt_rounded, actionLabel: ctx.isGestion && a.statut == 'PLANIFIEE' ? d.ag.ajouterResolution : null, onAction: () => _ajouterResolution(context, ref, a))
              else
                CardList([
                  for (final r in resolutions) ...[
                    ListRow(
                      leading: OrdreResolution(r.ordre),
                      title: r.texte,
                      subtitle: '${d.enums.typeMajorite[r.typeMajorite] ?? r.typeMajorite} — ${d.enums.typeMajoriteAide[r.typeMajorite] ?? ''}',
                      trailing: StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral, small: true),
                      onTap: a.statut == 'CLOTUREE' || a.statut == 'EN_COURS' ? () => _resultats(context, ref, a, r, ctx) : null,
                    ),
                    // M22 — suivi d'exécution d'une résolution adoptée (copropriétaires inclus).
                    if (r.resultat == 'ADOPTEE') ExecutionResolutionLigne(agId: a.id, resolution: r),
                  ],
                ]),
              // E4 — procurations (résidents propriétaires ; AG convoquée).
              if (ctx.voitAg && !ctx.isGestion && (a.statut == 'CONVOQUEE' || a.statut == 'PLANIFIEE')) ...[
                SectionHeader(d.ag.procurations, subtitle: md.cannotAttend),
                if (mesProcs.isNotEmpty)
                  CardList([
                    for (final p in mesProcs)
                      ListRow(
                        leading: const IconCircle(Icons.assignment_ind_rounded, tone: Tone.lilac),
                        title: '${d.ag.mandataire} :${membres.where((m) => m.id == p.mandataireId).map((m) => m.nom).firstOrNull ?? p.mandataireId.substring(0, 8)}',
                        subtitle: '${d.invitations.lot} ${lots.where((x) => x.id == p.lotId).map((x) => x.numero).firstOrNull ?? ''} · ${formatDateCourte(p.creeLe, l)}',
                        trailing: a.statut != 'EN_COURS' ? LinkButton(d.ag.revoquer, color: SuColors.danger, onTap: () => _revoquer(context, ref, p)) : null,
                      ),
                  ]),
                if (mesProcs.isEmpty && mesLots.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: FilledButton.icon(onPressed: () => _donnerProcuration(context, ref, a, mesLots, membres, ctx), icon: const Icon(Icons.assignment_ind_rounded), label: Text(d.ag.donnerProcuration))),
                if (recues.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: SuBanner(tone: BannerTone.info, body: '${recues.length} × ${d.ag.viaProcuration.replaceAll('{nom}', '').trim()}')),
              ],
              if (ctx.isGestion && procs.isNotEmpty) ...[
                SectionHeader(d.ag.procurations, subtitle: d.ag.procurationsAide),
                CardList([
                  for (final p in procs)
                    ListRow(
                      leading: const IconCircle(Icons.assignment_ind_rounded, tone: Tone.lilac),
                      title: '${membres.where((m) => m.id == p.mandantId).map((m) => m.nom).firstOrNull ?? p.mandantId.substring(0, 8)} → ${membres.where((m) => m.id == p.mandataireId).map((m) => m.nom).firstOrNull ?? p.mandataireId.substring(0, 8)}',
                      subtitle: '${d.invitations.lot} ${lots.where((x) => x.id == p.lotId).map((x) => x.numero).firstOrNull ?? ''}',
                    ),
                ]),
              ],
              // Actions syndic selon le statut.
              if (ctx.isGestion) ...[
                const SizedBox(height: 20),
                if (a.statut == 'PLANIFIEE') _ActionAg(label: d.ag.convoquer, hint: d.ag.convoquerAide, icon: Icons.send_rounded, path: '/ag/$id/convoquer', onDone: refresh, successMessage: d.ag.convoquee),
                if (a.statut == 'CONVOQUEE') _ActionAg(label: d.ag.ouvrirSeance, hint: d.ag.ouvrirSeanceAide, icon: Icons.play_arrow_rounded, path: '/ag/$id/ouvrir', onDone: () {
                  refresh();
                  context.push('/ag/$id/seance');
                }),
                if (a.statut == 'PLANIFIEE' || a.statut == 'CONVOQUEE') ...[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(onPressed: () => _annuler(context, ref, a), style: OutlinedButton.styleFrom(foregroundColor: SuColors.danger), icon: const Icon(Icons.cancel_outlined), label: Text(d.ag.annuler)),
                ],
                if (a.statut == 'ANNULEE' || a.statut == 'CLOTUREE') OutlinedButton.icon(onPressed: () => context.push('/ag/nouvelle'), icon: const Icon(Icons.replay_rounded), label: Text(d.ag.recreer)),
              ],
            ],
          );
        }),
      ],
    );
  }

  Future<void> _ajouterResolution(BuildContext context, WidgetRef ref, AssembleeGenerale a) async {
    await showFormSheet<void>(context, title: context.dict.ag.ajouterResolution, builder: (_) => _ResolutionForm(ag: a));
  }

  Future<void> _annuler(BuildContext context, WidgetRef ref, AssembleeGenerale a) async {
    await showFormSheet<void>(context, title: context.dict.ag.annuler, builder: (_) => _AnnulerForm(ag: a));
  }

  Future<void> _revoquer(BuildContext context, WidgetRef ref, AgProcuration p) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.ag.revoquer, body: d.ag.procurationsAide, danger: true);
    if (!ok) return;
    final r = await ref.read(apiClientProvider).post<dynamic>('/ag/$id/procurations/${p.id}/revoquer');
    if (!context.mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
    } else {
      ref.invalidate(agProcurationsProvider(id));
      showToast(context, d.ag.procurationRevoquee);
    }
  }

  Future<void> _donnerProcuration(BuildContext context, WidgetRef ref, AssembleeGenerale a, List<Lot> mesLots, List<MembreOption> membres, AppContext ctx) async {
    await showFormSheet<void>(context, title: context.dict.ag.donnerProcuration, builder: (_) => _ProcurationForm(ag: a, mesLots: mesLots, membres: membres.where((m) => m.id != ctx.profil.id).toList()));
  }

  Future<void> _resultats(BuildContext context, WidgetRef ref, AssembleeGenerale a, AgResolution r, AppContext ctx) async {
    final d = context.dict;
    await showModalBottomSheet<void>(
      useRootNavigator: true,
      context: context,
      sheetAnimationStyle: SuMotion.sheet,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                OrdreResolution(r.ordre),
                const SizedBox(width: 12),
                Expanded(child: Text('${d.ag.resolution} ${r.ordre}', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: SuColors.soft))),
                StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral, small: true),
              ]),
              const SizedBox(height: 12),
              Text(r.texte, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 16),
              SuCard(child: ResultatsWidget(agId: a.id, resolution: r)),
              if (ctx.isGestion) Padding(padding: const EdgeInsets.only(top: 8), child: Center(child: LinkButton(d.ag.detailVotes, onTap: () {
                Navigator.pop(sheet);
                context.push('/ag/${a.id}/resolutions/${r.id}/votes');
              }))),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pastille de numéro d'ordre d'une résolution — même gabarit que `IconCircle` (48, sauge).
class OrdreResolution extends StatelessWidget {
  const OrdreResolution(this.ordre, {super.key, this.size = 48});
  final int ordre;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: SuColors.sageTint, shape: BoxShape.circle),
        child: Text('$ordre', textDirection: TextDirection.ltr, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: SuColors.link, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
      );
}

class _ActionAg extends ConsumerStatefulWidget {
  const _ActionAg({required this.label, required this.hint, required this.icon, required this.path, required this.onDone, this.successMessage});
  final String label, hint, path;
  final IconData icon;
  final VoidCallback onDone;
  final String? successMessage;
  @override
  ConsumerState<_ActionAg> createState() => _ActionAgState();
}

class _ActionAgState extends ConsumerState<_ActionAg> {
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FormError(_fail, onSettings: () => context.push('/parametres')),
        if (_fail != null) const SizedBox(height: 10),
        SubmitButton(
          label: widget.label,
          icon: widget.icon,
          loading: _loading,
          onPressed: () async {
            final ok = await confirmDialog(context, title: widget.label, body: widget.hint);
            if (!ok) return;
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>(widget.path);
            if (!context.mounted) return;
            setState(() => _loading = false);
            if (r is ApiFail) {
              setState(() => _fail = r);
              return;
            }
            if (widget.successMessage != null) showToast(context, widget.successMessage!);
            widget.onDone();
          },
        ),
        const SizedBox(height: 6),
        Text(widget.hint, style: Theme.of(context).textTheme.labelSmall, textAlign: TextAlign.center),
      ],
    );
  }
}

class _Countdown extends StatefulWidget {
  const _Countdown(this.iso);
  final String iso;
  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  @override
  void initState() {
    super.initState();
    _tick();
  }

  void _tick() => Future.delayed(const Duration(seconds: 30), () {
        if (mounted) {
          setState(() {});
          _tick();
        }
      });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final diff = DateTime.parse(widget.iso).difference(DateTime.now());
    if (diff.isNegative) return const SizedBox.shrink();
    // Compte à rebours en affiche Wise : salle encre, chiffres d'affiche sauge.
    Widget cell(int v, String label) => Expanded(child: Column(children: [Text(v.toString().padLeft(2, '0'), textDirection: TextDirection.ltr, style: SuType.poster(context, 44, color: SuColors.cta).copyWith(fontFamily: 'SuDisplay', fontFeatures: const [FontFeature.tabularFigures()])), const SizedBox(height: 4), Text(label, style: t.labelSmall?.copyWith(color: Colors.white70))]));
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18),
      decoration: BoxDecoration(color: SuColors.ink, borderRadius: BorderRadius.circular(24)),
      child: Row(children: [cell(diff.inDays, 'j'), cell(diff.inHours % 24, 'h'), cell(diff.inMinutes % 60, 'min')]),
    );
  }
}

/// Agrégats d'une résolution (pour / contre / abstention en tantièmes) — jamais nominatif ici.
class ResultatsWidget extends ConsumerWidget {
  const ResultatsWidget({super.key, required this.agId, required this.resolution, this.dark = false});
  final String agId;
  final AgResolution resolution;
  final bool dark;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final res = ref.watch(agResultatsProvider((agId: agId, resolutionId: resolution.id)));
    final fg = dark ? Colors.white : SuColors.ink;
    return res.when(
      loading: () => const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Center(child: LoadingOrb(size: 9))),
      error: (e, _) => ErrorState(error: e),
      data: (lignes) {
        BigInt tant(String v) => BigInt.tryParse((lignes.where((x) => x.valeur == v).firstOrNull?.tantiemesTotal ?? '0').split('.').first) ?? BigInt.zero;
        int nb(String v) => lignes.where((x) => x.valeur == v).firstOrNull?.nbVotants ?? 0;
        final pour = tant('POUR'), contre = tant('CONTRE'), abst = tant('ABSTENTION');
        final total = pour + contre + abst;
        Widget row(String v, BigInt val, Color c) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(child: Text(d.enums.valeurVote[v] ?? v, style: t.titleSmall?.copyWith(color: fg))),
                    Text('${formatEntier(val.toString())} t. · ${nb(v)}', textDirection: TextDirection.ltr, style: t.bodyMedium?.copyWith(color: fg, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()])),
                  ]),
                  const SizedBox(height: 6),
                  Gauge(total == BigInt.zero ? 0 : (val * BigInt.from(1000) ~/ total).toInt() / 1000, color: c, height: 8),
                ],
              ),
            );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            row('POUR', pour, SuColors.ok),
            row('CONTRE', contre, SuColors.danger),
            row('ABSTENTION', abst, SuColors.faint),
            const SizedBox(height: 6),
            Text('${fill(d.ag.votants, {'n': nb('POUR') + nb('CONTRE') + nb('ABSTENTION')})} · ${formatEntier(total.toString())} ${d.ag.tantiemes}', style: t.bodySmall?.copyWith(color: dark ? Colors.white70 : SuColors.soft)),
          ],
        );
      },
    );
  }
}

class _ResolutionForm extends ConsumerStatefulWidget {
  const _ResolutionForm({required this.ag});
  final AssembleeGenerale ag;
  @override
  ConsumerState<_ResolutionForm> createState() => _ResolutionFormState();
}

class _ResolutionFormState extends ConsumerState<_ResolutionForm> {
  late final _ordre = TextEditingController(text: '${widget.ag.resolutions.length + 1}');
  final _texte = TextEditingController();
  String _maj = 'SIMPLE';
  bool _execution = false;
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.ag.ordre, controller: _ordre, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], required: true, error: fieldError(_fail, 'ordre'), textDirection: TextDirection.ltr),
        const SizedBox(height: 12),
        SuField(label: d.ag.texteResolution, controller: _texte, maxLines: 4, required: true, error: fieldError(_fail, 'texte')),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.ag.typeMajorite, value: _maj, options: const ['SIMPLE', 'DOUBLE', 'UNANIMITE'], labelOf: (v) => d.enums.typeMajorite[v] ?? v, onChanged: (v) => setState(() => _maj = v), help: d.enums.typeMajoriteAide[_maj]),
        const SizedBox(height: 8),
        SuCheckbox(value: _execution, onChanged: (v) => setState(() => _execution = v), label: d.taches.necessiteExecution),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.add,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/ag/${widget.ag.id}/resolutions', body: {'ordre': int.tryParse(_ordre.text) ?? 1, 'texte': _texte.text.trim(), 'type_majorite': _maj, 'necessite_execution': _execution});
            if (!context.mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(agProvider(widget.ag.id));
            Navigator.pop(context);
          },
        ),
      ],
    );
  }
}

class _AnnulerForm extends ConsumerStatefulWidget {
  const _AnnulerForm({required this.ag});
  final AssembleeGenerale ag;
  @override
  ConsumerState<_AnnulerForm> createState() => _AnnulerFormState();
}

class _AnnulerFormState extends ConsumerState<_AnnulerForm> {
  final _motif = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuBanner(tone: BannerTone.warn, body: d.ag.annulerCorps),
        const SizedBox(height: 16),
        SuField(label: d.ag.annulerMotif, controller: _motif, maxLines: 3, required: true, error: fieldError(_fail, 'motif')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.ag.annuler,
          danger: true,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/ag/${widget.ag.id}/annuler', body: {'motif': _motif.text.trim()});
            if (!context.mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(agProvider(widget.ag.id));
            ref.invalidate(agListProvider);
            Navigator.pop(context);
          },
        ),
      ],
    );
  }
}

/// E4 — donner procuration (cas MRE) ; l'état gaté légal (422) s'affiche en information.
class _ProcurationForm extends ConsumerStatefulWidget {
  const _ProcurationForm({required this.ag, required this.mesLots, required this.membres});
  final AssembleeGenerale ag;
  final List<Lot> mesLots;
  final List<MembreOption> membres;
  @override
  ConsumerState<_ProcurationForm> createState() => _ProcurationFormState();
}

class _ProcurationFormState extends ConsumerState<_ProcurationForm> {
  String? _lot;
  String? _mandataire;
  String _q = '';
  bool _loading = false;
  ApiFail? _fail;
  @override
  void initState() {
    super.initState();
    _lot = widget.mesLots.firstOrNull?.id;
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final visibles = widget.membres.where((m) => _q.isEmpty || m.nom.toLowerCase().contains(_q)).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuBanner(tone: BannerTone.info, body: d.ag.mandataireAide),
        const SizedBox(height: 12),
        if (widget.mesLots.length > 1) ...[
          SuSelect<String>(label: d.invitations.lot, value: _lot, options: widget.mesLots.map((x) => x.id).toList(), labelOf: (id) => widget.mesLots.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true),
          const SizedBox(height: 12),
        ],
        Text(d.ag.mandataire, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 6),
        TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: InputDecoration(hintText: d.common.search, prefixIcon: const Icon(Icons.search_rounded))),
        const SizedBox(height: 8),
        // Liste bornée et défilante (au-delà de 260 px, la colonne débordait).
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 280),
          child: SingleChildScrollView(
            child: CardList([
              for (final m in visibles.take(30))
                ListRow(
                  leading: Avatar(m.nom, size: 48),
                  title: m.nom,
                  subtitle: m.lots.join(', '),
                  trailing: Icon(m.id == _mandataire ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, color: m.id == _mandataire ? SuColors.link : SuColors.hairlineStrong, size: 26),
                  onTap: () => setState(() => _mandataire = m.id),
                ),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.ag.donnerProcuration,
          loading: _loading,
          onPressed: _lot == null || _mandataire == null
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final r = await ref.read(apiClientProvider).post<dynamic>('/ag/${widget.ag.id}/procurations', body: {'lot_id': _lot, 'mandataire_id': _mandataire});
                  if (!context.mounted) return;
                  if (r is ApiFail) {
                    setState(() {
                      _loading = false;
                      _fail = r;
                    });
                    return;
                  }
                  ref.invalidate(agProcurationsProvider(widget.ag.id));
                  // Acte délibéré et unique : succès plein écran (contexte racine, la feuille se ferme).
                  final root = Navigator.of(context, rootNavigator: true).context;
                  final nom = widget.membres.where((m) => m.id == _mandataire).map((m) => m.nom).firstOrNull;
                  Navigator.pop(context);
                  showSuccess(root, title: d.ag.procurationDonnee, body: nom == null ? null : '${d.ag.mandataire} : $nom', illustration: 'ok-vote');
                },
        ),
      ],
    );
  }
}

// ── E7 PV ─────────────────────────────────────────────────────────────────────
class AgPvScreen extends ConsumerWidget {
  const AgPvScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final pv = ref.watch(agPvProvider(id));
    return SuPage(
      title: d.ag.pvTitre,
      children: [
        AsyncView(pv, onRetry: () => ref.invalidate(agPvProvider(id)), data: (p) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Synthèse Wise : grande pastille, type et date, quorum en gros chiffre.
              SuCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const IconCircle(Icons.gavel_rounded, tone: Tone.lilac, size: 56),
                        const Spacer(),
                        StatusBadge(d.enums.statutAg['CLOTUREE'] ?? 'CLOTUREE', variant: BadgeVariant.ok),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text('${d.enums.typeAg[p.typeAg ?? ''] ?? ''} · ${formatDate(p.dateAg, l)}', style: t.headlineSmall),
                    const SizedBox(height: 14),
                    Text(d.ag.quorum, style: t.labelMedium?.copyWith(color: SuColors.soft)),
                    Text(formatPourcent(double.tryParse(p.quorumAtteint ?? '')), textDirection: TextDirection.ltr, style: t.displaySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                    Text(fill(d.ag.quorumRequis, {'val': formatPourcent(double.tryParse(p.quorumRequis ?? ''))}), style: t.bodyMedium?.copyWith(color: SuColors.soft)),
                    const SizedBox(height: 10),
                    Text('${d.ag.cloturee} · ${formatDateHeure(p.horodatageGeneration, l)}', style: t.bodySmall),
                  ],
                ),
              ),
              SectionHeader(d.ag.resultats, subtitle: '${p.resolutions.length} ${d.ag.resolutions.toLowerCase()}'),
              for (final r in p.resolutions..sort((a, b) => a.ordre.compareTo(b.ordre)))
                SuCard(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        OrdreResolution(r.ordre),
                        const SizedBox(width: 12),
                        Expanded(child: Text(d.enums.typeMajorite[r.typeMajorite] ?? r.typeMajorite, style: t.bodyMedium?.copyWith(color: SuColors.soft))),
                        StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral, small: true),
                      ]),
                      const SizedBox(height: 12),
                      Text(r.texte, style: t.titleMedium),
                      const SizedBox(height: 8),
                      ResultatsWidget(agId: id, resolution: AgResolution(id: r.id, agId: id, ordre: r.ordre, texte: r.texte, typeMajorite: r.typeMajorite, resultat: r.resultat)),
                    ],
                  ),
                ),
              const SizedBox(height: 4),
              // Empreinte d'intégrité : la carte-affiche sombre de l'écran (valeur probante).
              SuCard(
                color: SuColors.ink,
                radius: 28,
                padding: const EdgeInsets.all(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [const IconCircle(Icons.verified_user_rounded, tone: Tone.ink, size: 44), const SizedBox(width: 12), Expanded(child: Text(d.ag.pvHash, style: t.titleMedium?.copyWith(color: Colors.white)))]),
                    const SizedBox(height: 10),
                    Text(d.ag.pvHashAide, style: t.bodyMedium?.copyWith(color: Colors.white70)),
                    const SizedBox(height: 12),
                    SelectableText(p.hashIntegrite, textDirection: TextDirection.ltr, style: t.labelSmall?.copyWith(color: SuColors.cta, fontFamily: 'GeistMono', height: 1.5)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => ouvrirPdfApi(context, ref, endpoint: '/ag/$id/pv/pdf', titre: d.ag.pvTitre, messageErreur: d.ag.pvIndisponible),
                icon: const Icon(Icons.picture_as_pdf_rounded),
                label: Text(d.ag.pvTelecharger),
              ),
              const SizedBox(height: 6),
              Text(md.pdfFr, style: t.labelSmall, textAlign: TextAlign.center),
            ],
          );
        }),
      ],
    );
  }
}

// ── E6 Détail nominatif (syndic) ──────────────────────────────────────────────
class AgVotesScreen extends ConsumerWidget {
  const AgVotesScreen({super.key, required this.agId, required this.resolutionId});
  final String agId, resolutionId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final votes = ref.watch(agVotesProvider((agId: agId, resolutionId: resolutionId)));
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final membres = annuaireDepuisLots(lots);
    return SuPage(
      title: d.ag.detailVotes,
      children: [
        SuBanner(tone: BannerTone.warn, body: d.ag.detailVotesBandeau),
        const SizedBox(height: 12),
        AsyncView(votes, onRetry: () => ref.invalidate(agVotesProvider((agId: agId, resolutionId: resolutionId))), data: (list) {
          if (list.isEmpty) return EmptyState(title: d.common.emptyDefault, icon: Icons.how_to_vote_rounded, illustration: 'empty-ag');
          return CardList([
            for (final v in list)
              ListRow(
                leading: Avatar(membres.where((m) => m.id == v.utilisateurId).map((m) => m.nom).firstOrNull ?? '?', size: 48),
                title: membres.where((m) => m.id == v.utilisateurId).map((m) => m.nom).firstOrNull ?? v.utilisateurId.substring(0, 8),
                subtitle: '${d.invitations.lot} ${lots.where((x) => x.id == v.lotId).map((x) => x.numero).firstOrNull ?? ''} · ${formatEntier(v.tantiemesRepresentes)} t. · ${formatDateHeure(v.horodatage, l)}',
                trailing: StatusBadge(d.enums.valeurVote[v.valeur] ?? v.valeur, variant: v.valeur == 'POUR' ? BadgeVariant.ok : v.valeur == 'CONTRE' ? BadgeVariant.danger : BadgeVariant.neutral, small: true),
              ),
          ]);
        }),
        const SizedBox(height: 8),
        Text(fill(d.ag.votants, {'n': votes.valueOrNull?.length ?? 0}), style: t.bodySmall),
      ],
    );
  }
}
