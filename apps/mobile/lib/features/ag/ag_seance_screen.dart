import 'dart:async';

import 'package:flutter/material.dart';
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
import '../../core/theme/motion.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import 'ag_screens.dart';

/// E5 — séance live : vue votant (salle sombre en tête, vote pondéré + procuration, vote
/// immuable dit AVANT) ou pupitre syndic (agrégats live, finalisation, clôture verrouillée).
class AgSeanceScreen extends ConsumerStatefulWidget {
  const AgSeanceScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<AgSeanceScreen> createState() => _AgSeanceScreenState();
}

class _AgSeanceScreenState extends ConsumerState<AgSeanceScreen> {
  Timer? _poll;
  @override
  void initState() {
    super.initState();
    // Suivi léger de la séance (résolutions finalisées, clôture) — 5 s comme le web.
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => ref.invalidate(agProvider(widget.id)));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final ag = ref.watch(agProvider(widget.id));
    ref.listen(agProvider(widget.id), (_, next) {
      final a = next.valueOrNull;
      if (a != null && a.statut == 'CLOTUREE' && !ctx.isGestion) context.pushReplacement('/ag/${widget.id}/pv');
    });
    return ag.when(
      loading: () => SuPage(title: ctx.isGestion ? d.ag.pupitre : d.ag.seance, children: const [LoadingList(count: 3, height: 150)]),
      error: (e, _) => SuPage(title: ctx.isGestion ? d.ag.pupitre : d.ag.seance, children: [ErrorState(error: e, onRetry: () => ref.invalidate(agProvider(widget.id)))]),
      data: (a) => ctx.isGestion ? _Pupitre(ag: a) : _VueVotant(ag: a),
    );
  }
}

/// « Salle » de séance : bandeau encre en tête (statut live, quorum, résolution courante en
/// capitales d'affiche, progression de l'ordre du jour, navigation ronde).
class _Salle extends StatelessWidget {
  const _Salle({required this.resolutions, required this.index, this.quorum, this.onPrev, this.onNext});
  final List<AgResolution> resolutions;
  final int index;
  final String? quorum;
  final VoidCallback? onPrev, onNext;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final i = index.clamp(0, resolutions.length - 1);
    final r = resolutions[i];
    Widget nav(IconData icon, String tip, VoidCallback? onTap) => CircleIconButton(
          icon: icon,
          mirror: true,
          tooltip: tip,
          onTap: onTap,
          color: Colors.white.withValues(alpha: onTap == null ? 0.05 : 0.14),
          iconColor: onTap == null ? Colors.white.withValues(alpha: 0.25) : Colors.white,
        );
    return SuCard(
      color: SuColors.ink,
      radius: 28,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusBadge(d.enums.statutAg['EN_COURS'] ?? 'EN_COURS', variant: BadgeVariant.warn, pulse: true, small: true),
              const SizedBox(width: 10),
              if (quorum != null) Expanded(child: AnimatedFigureText(quorum!, textAlign: TextAlign.end, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.labelMedium?.copyWith(color: Colors.white70))) else const Spacer(),
            ],
          ),
          const SizedBox(height: 22),
          Text(SuType.posterText(context, '${d.ag.resolution} ${r.ordre}'), style: SuType.poster(context, 40, color: SuColors.cta)),
          const SizedBox(height: 16),
          // Ordre du jour : un segment par résolution (finalisée = sauge, courante = blanc).
          Row(
            children: [
              for (int k = 0; k < resolutions.length; k++)
                Expanded(
                  child: Container(
                    height: 5,
                    margin: EdgeInsetsDirectional.only(end: k < resolutions.length - 1 ? 4 : 0),
                    decoration: BoxDecoration(
                      color: k == i ? Colors.white : resolutions[k].resultat != 'EN_ATTENTE' ? SuColors.cta : Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              nav(Icons.arrow_back_rounded, d.ag.resolutionPrecedente, onPrev),
              Expanded(child: Text('${i + 1} / ${resolutions.length}', textAlign: TextAlign.center, textDirection: TextDirection.ltr, style: t.titleMedium?.copyWith(color: Colors.white, fontFeatures: const [FontFeature.tabularFigures()]))),
              nav(Icons.arrow_forward_rounded, d.ag.resolutionSuivante, onNext),
            ],
          ),
        ],
      ),
    );
  }
}

/// Gros bouton de vote (pill 68 px) : pastille teintée + libellé ; choisi = plein, coche.
class _VoteChoice extends StatelessWidget {
  const _VoteChoice({required this.label, required this.icon, required this.color, required this.tint, required this.selected, this.onTap});
  final String label;
  final IconData icon;
  final Color color, tint;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final fg = selected ? Colors.white : SuColors.ink;
    return Semantics(
      button: true,
      selected: selected,
      enabled: onTap != null,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: SuTap(
          ink: false,
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: AnimatedContainer(
            duration: SuMotion.of(context, SuMotion.base),
            curve: SuMotion.easeOut,
            height: 68,
            decoration: ShapeDecoration(color: selected ? color : SuColors.surface, shape: const StadiumBorder()),
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(10, 0, 18, 0),
              child: Row(
                children: [
                  AnimatedContainer(
                    duration: SuMotion.of(context, SuMotion.base),
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(color: selected ? Colors.white.withValues(alpha: 0.18) : tint, shape: BoxShape.circle),
                    child: Icon(icon, size: 24, color: selected ? Colors.white : color),
                  ),
                  const SizedBox(width: 14),
                  Expanded(child: Text(label, style: t.titleLarge?.copyWith(color: fg), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  AnimatedScale(
                    scale: selected ? 1 : 0,
                    duration: SuMotion.of(context, SuMotion.base),
                    curve: SuMotion.easeOut,
                    child: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 26),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Vue votant ────────────────────────────────────────────────────────────────
class _VueVotant extends ConsumerStatefulWidget {
  const _VueVotant({required this.ag});
  final AssembleeGenerale ag;
  @override
  ConsumerState<_VueVotant> createState() => _VueVotantState();
}

class _VueVotantState extends ConsumerState<_VueVotant> {
  int _index = -1;
  String? _identite; // lot:<id> | proc:<id>
  String? _choix;
  final Map<String, String> _votes = {}; // resolutionId|identite → valeur
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final ag = widget.ag;
    final resolutions = [...ag.resolutions]..sort((x, y) => x.ordre.compareTo(y.ordre));
    if (_index < 0) _index = resolutions.indexWhere((r) => r.resultat == 'EN_ATTENTE').clamp(0, resolutions.length);
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final mesLots = lots.where((x) => x.estProprietaire(ctx.profil.id)).toList();
    final procs = (ref.watch(agProcurationsProvider(ag.id)).valueOrNull ?? const <AgProcuration>[]).where((p) => p.active && p.mandataireId == ctx.profil.id).toList();
    final membres = annuaireDepuisLots(lots);
    final identites = [
      for (final x in mesLots) ('lot:${x.id}', fill(d.ag.voterPourLot, {'numero': x.numero}), x.tantiemes),
      for (final p in procs) ('proc:${p.id}', '${fill(d.ag.viaProcuration, {'nom': membres.where((m) => m.id == p.mandantId).map((m) => m.nom).firstOrNull ?? ''})} · ${lots.where((x) => x.id == p.lotId).map((x) => x.numero).firstOrNull ?? ''}', lots.where((x) => x.id == p.lotId).map((x) => x.tantiemes).firstOrNull ?? '0'),
    ];
    _identite ??= identites.firstOrNull?.$1;
    if (resolutions.isEmpty) {
      return SuPage(title: d.ag.seance, children: [EmptyState(title: d.ag.aucuneResolution, icon: Icons.list_alt_rounded, illustration: 'empty-ag')]);
    }
    final r = resolutions[_index.clamp(0, resolutions.length - 1)];
    final cle = '${r.id}|$_identite';
    final voteFait = _votes[cle];
    final peutVoter = r.resultat == 'EN_ATTENTE' && voteFait == null && _identite != null;

    return SuPage(
      title: d.ag.seance,
      subtitle: d.enums.typeAg[ag.type] ?? ag.type,
      children: [
        _Salle(
          resolutions: resolutions,
          index: _index,
          quorum: ag.quorumAtteint != null ? '${md.quorumAtteint} ${formatPourcent(double.tryParse(ag.quorumAtteint!))}' : null,
          onPrev: _index > 0 ? () => setState(() { _index--; _choix = null; _fail = null; }) : null,
          onNext: _index < resolutions.length - 1 ? () => setState(() { _index++; _choix = null; _fail = null; }) : null,
        ),
        const SizedBox(height: 12),
        // La résolution : texte lisible en grand, majorité requise, statut.
        SuCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(d.enums.typeMajorite[r.typeMajorite] ?? r.typeMajorite, style: t.labelMedium?.copyWith(color: SuColors.soft))),
                  StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral),
                ],
              ),
              const SizedBox(height: 14),
              Text(r.texte, style: t.headlineSmall?.copyWith(height: 1.4)),
              const SizedBox(height: 10),
              Text(d.enums.typeMajoriteAide[r.typeMajorite] ?? '', style: t.bodyMedium?.copyWith(color: SuColors.soft)),
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (identites.isEmpty)
          SuBanner(tone: BannerTone.warn, body: d.ag.indivisaireImpaye)
        else if (identites.length == 1)
          CardList([ListRow(leading: const IconCircle(Icons.how_to_vote_rounded, tone: Tone.neutral), title: identites.first.$2, subtitle: d.ag.voterEnTantQue)])
        else
          SuSelect<String>(label: d.ag.voterEnTantQue, value: _identite, options: identites.map((i) => i.$1).toList(), labelOf: (v) => identites.firstWhere((i) => i.$1 == v).$2, onChanged: (v) => setState(() { _identite = v; _choix = null; })),
        const SizedBox(height: 16),
        if (voteFait != null || r.resultat != 'EN_ATTENTE')
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: SuColors.okTint, borderRadius: BorderRadius.circular(SuRadius.card)),
            child: Row(
              children: [
                const IconCircle(Icons.check_rounded, tone: Tone.ok),
                const SizedBox(width: 14),
                Expanded(
                  child: voteFait != null
                      ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d.ag.voteEnregistre, style: t.titleMedium), const SizedBox(height: 2), Text('${d.enums.valeurVote[voteFait]} · ${d.ag.voteImmuable}', style: t.bodySmall)])
                      : Text(d.ag.dejaVote, style: t.titleMedium),
                ),
              ],
            ),
          )
        else ...[
          // Trois gros boutons, un tap = un choix ; l'enregistrement reste une étape confirmée.
          for (final v in const [
            ('POUR', Icons.thumb_up_alt_rounded, SuColors.ok, SuColors.okTint),
            ('CONTRE', Icons.thumb_down_alt_rounded, SuColors.danger, SuColors.dangerTint),
            ('ABSTENTION', Icons.remove_rounded, SuColors.ink, SuColors.wash),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _VoteChoice(
                label: d.enums.valeurVote[v.$1] ?? v.$1,
                icon: v.$2,
                color: v.$3,
                tint: v.$4,
                selected: _choix == v.$1,
                onTap: peutVoter ? () => setState(() => _choix = v.$1) : null,
              ),
            ),
          const SizedBox(height: 6),
          if (_fail != null) ...[
            _fail!.error.code == 'CONFLICT' ? SuBanner(tone: BannerTone.warn, body: d.ag.dejaVote) : FormError(_fail),
            const SizedBox(height: 12),
          ],
          SubmitButton(label: md.registerVote, loading: _loading, fail: _fail, onPressed: _choix == null ? null : () => _confirmer(r)),
          const SizedBox(height: 10),
          Text(d.ag.voteImmuable, style: t.bodySmall, textAlign: TextAlign.center),
        ],
        const SizedBox(height: 20),
        Text(d.ag.voteAnonymeNote, style: t.bodySmall, textAlign: TextAlign.center),
      ],
    );
  }

  Future<void> _confirmer(AgResolution r) async {
    final d = context.dict;
    final choix = _choix!;
    final ok = await confirmDialog(context, title: d.ag.voteConfirmTitre, body: fill(d.ag.voteConfirmCorps, {'valeur': d.enums.valeurVote[choix] ?? choix, 'ordre': r.ordre}), confirmLabel: d.ag.voter, irreversible: true);
    if (!ok) return;
    setState(() {
      _loading = true;
      _fail = null;
    });
    final identite = _identite!;
    final body = <String, dynamic>{
      'resolution_id': r.id,
      'valeur': choix,
      if (identite.startsWith('proc:')) ...{'procuration_id': identite.substring(5), 'lot_id': null} else 'lot_id': identite.substring(4),
    };
    final res = await ref.read(apiClientProvider).post<AgVote>('/ag/${widget.ag.id}/votes', idempotent: true, body: body, parse: (j) => AgVote.fromJson(asMap(j)));
    if (!mounted) return;
    switch (res) {
      case ApiOk<AgVote>(:final data):
        setState(() {
          _loading = false;
          _votes['${r.id}|$identite'] = data.valeur;
          _choix = null;
        });
        ref.invalidate(agResultatsProvider((agId: widget.ag.id, resolutionId: r.id)));
        // Séance : on vote résolution après résolution — un toast bref, pas d'écran plein.
        showToast(context, d.ag.voteEnregistre);
      case ApiFail<AgVote>():
        setState(() {
          _loading = false;
          _fail = res;
        });
    }
  }
}

// ── Pupitre syndic ────────────────────────────────────────────────────────────
class _Pupitre extends ConsumerStatefulWidget {
  const _Pupitre({required this.ag});
  final AssembleeGenerale ag;
  @override
  ConsumerState<_Pupitre> createState() => _PupitreState();
}

class _PupitreState extends ConsumerState<_Pupitre> {
  int _index = -1;
  bool _loading = false;
  ApiFail? _fail;
  Timer? _live;

  @override
  void initState() {
    super.initState();
    _live = Timer.periodic(const Duration(seconds: 5), (_) {
      final r = _courante;
      if (r != null) ref.invalidate(agResultatsProvider((agId: widget.ag.id, resolutionId: r.id)));
    });
  }

  @override
  void dispose() {
    _live?.cancel();
    super.dispose();
  }

  List<AgResolution> get _resolutions => [...widget.ag.resolutions]..sort((x, y) => x.ordre.compareTo(y.ordre));
  AgResolution? get _courante {
    final rs = _resolutions;
    if (rs.isEmpty) return null;
    if (_index < 0) _index = rs.indexWhere((r) => r.resultat == 'EN_ATTENTE').clamp(0, rs.length - 1);
    return rs[_index.clamp(0, rs.length - 1)];
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final ag = widget.ag;
    final rs = _resolutions;
    final r = _courante;
    final enAttente = rs.where((x) => x.resultat == 'EN_ATTENTE').length;
    return SuPage(
      title: d.ag.pupitre,
      subtitle: '${md.seanceEnCours} · ${d.enums.typeAg[ag.type] ?? ''}',
      children: [
        if (ag.statut == 'CLOTUREE') ...[
          SuBanner(tone: BannerTone.ok, title: d.ag.cloturee, body: d.ag.toutesFinalisees),
          const SizedBox(height: 12),
          SuButton(onPressed: () => context.pushReplacement('/ag/${ag.id}/pv'), icon: Icons.gavel_rounded, label: d.ag.pv),
        ] else if (r == null) ...[
          EmptyState(title: d.ag.aucuneResolution, icon: Icons.list_alt_rounded, illustration: 'empty-ag'),
        ] else ...[
          _Salle(
            resolutions: rs,
            index: _index,
            quorum: ag.quorumAtteint != null ? '${md.quorumAtteint} ${formatPourcent(double.tryParse(ag.quorumAtteint!))}' : null,
            onPrev: _index > 0 ? () => setState(() { _index--; _fail = null; }) : null,
            onNext: _index < rs.length - 1 ? () => setState(() { _index++; _fail = null; }) : null,
          ),
          const SizedBox(height: 12),
          SuCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(child: Align(alignment: AlignmentDirectional.centerStart, child: StatusBadge(d.enums.typeMajorite[r.typeMajorite] ?? r.typeMajorite, variant: BadgeVariant.info, small: true))),
                  StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral, small: true),
                ]),
                const SizedBox(height: 14),
                Text(r.texte, style: t.headlineSmall?.copyWith(height: 1.4)),
                const SizedBox(height: 8),
                Text(d.enums.typeMajoriteAide[r.typeMajorite] ?? '', style: t.bodyMedium?.copyWith(color: SuColors.soft)),
              ],
            ),
          ),
          SectionHeader(md.liveResults, subtitle: d.ag.resultats),
          SuCard(child: ResultatsWidget(agId: ag.id, resolution: r)),
          const SizedBox(height: 12),
          SuBanner(tone: BannerTone.info, body: md.pupitreRule),
          const SizedBox(height: 16),
          FormError(_fail),
          if (_fail != null) const SizedBox(height: 10),
          if (r.resultat == 'EN_ATTENTE')
            SubmitButton(
              label: '${d.ag.finaliser} · ${d.ag.resolution} ${r.ordre}',
              loading: _loading,
              fail: _fail,
              icon: Icons.check_rounded,
              onPressed: () async {
                final ok = await confirmDialog(context, title: d.ag.finaliser, body: d.ag.finaliserCorps, irreversible: true);
                if (!ok) return;
                setState(() {
                  _loading = true;
                  _fail = null;
                });
                final res = await ref.read(apiClientProvider).post<AgResolution>('/ag/${ag.id}/resolutions/${r.id}/finaliser', parse: (j) => AgResolution.fromJson(asMap(j)));
                if (!context.mounted) return;
                setState(() => _loading = false);
                if (res is ApiFail<AgResolution>) {
                  setState(() => _fail = res);
                  return;
                }
                ref.invalidate(agProvider(ag.id));
                // Finalisations à la chaîne pendant la séance : toast bref.
                showToast(context, '${d.enums.resultatResolution[(res as ApiOk<AgResolution>).data.resultat]}${res.data.resultat == 'REJETEE' ? ' · ${d.ag.egaliteRejetee}' : ''}');
              },
            )
          else if (_index < rs.length - 1)
            SubmitButton(label: d.ag.resolutionSuivante, secondary: true, icon: Icons.arrow_forward_rounded, onPressed: () => setState(() => _index++)),
          const SizedBox(height: 28),
          SubmitButton(
            label: d.ag.cloturer,
            danger: true,
            icon: Icons.lock_rounded,
            onPressed: enAttente > 0
                ? null
                : () async {
                    final ok = await confirmDialog(context, title: d.ag.cloturer, body: d.ag.cloturerCorps, danger: true, irreversible: true);
                    if (!ok) return;
                    final res = await ref.read(apiClientProvider).post<dynamic>('/ag/${ag.id}/cloturer');
                    if (!context.mounted) return;
                    if (res is ApiFail) {
                      setState(() => _fail = res);
                      return;
                    }
                    ref.invalidate(agProvider(ag.id));
                    ref.invalidate(agListProvider);
                    context.pushReplacement('/ag/${ag.id}/pv');
                  },
          ),
          const SizedBox(height: 8),
          Text(enAttente > 0 ? fill(d.ag.restentEnAttente, {'n': enAttente}) : d.ag.cloturerCorps, style: t.bodySmall, textAlign: TextAlign.center),
        ],
      ],
    );
  }
}
