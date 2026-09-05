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
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import 'ag_screens.dart';

/// E5 — séance live : vue votant (sombre pour la salle, vote pondéré + procuration, vote
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
    final ag = ref.watch(agProvider(widget.id));
    ref.listen(agProvider(widget.id), (_, next) {
      final a = next.valueOrNull;
      if (a != null && a.statut == 'CLOTUREE' && !ctx.isGestion) context.pushReplacement('/ag/${widget.id}/pv');
    });
    return ag.when(
      loading: () => Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(appBar: AppBar(), body: Padding(padding: const EdgeInsets.all(16), child: ErrorState(error: e, onRetry: () => ref.invalidate(agProvider(widget.id))))),
      data: (a) => ctx.isGestion ? _Pupitre(ag: a) : _VueVotant(ag: a),
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
      return Scaffold(appBar: AppBar(title: Text(d.ag.seance)), body: Padding(padding: const EdgeInsets.all(16), child: SuBanner(tone: BannerTone.info, body: d.ag.aucuneResolution)));
    }
    final r = resolutions[_index.clamp(0, resolutions.length - 1)];
    final cle = '${r.id}|$_identite';
    final voteFait = _votes[cle];
    final peutVoter = r.resultat == 'EN_ATTENTE' && voteFait == null && _identite != null;

    return SuPage(
      title: d.ag.seance,
      subtitle: '${md.seanceEnCours}${ag.quorumAtteint != null ? ' · ${md.quorumAtteint} ${formatPourcent(double.tryParse(ag.quorumAtteint!))}' : ''}',
      children: [
        Row(
          children: [
            Flexible(child: TextButton(onPressed: _index > 0 ? () => setState(() { _index--; _choix = null; _fail = null; }) : null, style: TextButton.styleFrom(foregroundColor: SuColors.body), child: Text(d.ag.resolutionPrecedente, maxLines: 1, overflow: TextOverflow.ellipsis))),
            Text('${_index + 1} / ${resolutions.length}', textAlign: TextAlign.center, style: t.labelMedium?.copyWith(color: SuColors.soft, fontFeatures: const [FontFeature.tabularFigures()])),
            Flexible(child: TextButton(onPressed: _index < resolutions.length - 1 ? () => setState(() { _index++; _choix = null; _fail = null; }) : null, style: TextButton.styleFrom(foregroundColor: SuColors.body), child: Text(d.ag.resolutionSuivante, maxLines: 1, overflow: TextOverflow.ellipsis))),
          ],
        ),
        SuCard(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(width: 36, height: 36, alignment: Alignment.center, decoration: const BoxDecoration(color: SuColors.actionTint, shape: BoxShape.circle), child: Text('${r.ordre}', style: t.labelMedium?.copyWith(color: SuColors.action, fontSize: 15, fontWeight: FontWeight.w600))),
                  const Spacer(),
                  StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral),
                ],
              ),
              const SizedBox(height: 20),
              Text(r.texte, style: t.titleLarge?.copyWith(fontSize: 17, fontWeight: FontWeight.w500, height: 1.5)),
              const SizedBox(height: 8),
              Text('${d.enums.typeMajorite[r.typeMajorite] ?? r.typeMajorite} — ${d.enums.typeMajoriteAide[r.typeMajorite] ?? ''}', style: t.bodySmall),
              const SizedBox(height: 22),
              if (identites.isEmpty)
                SuBanner(tone: BannerTone.warn, body: d.ag.indivisaireImpaye)
              else if (identites.length == 1)
                Text(identites.first.$2, style: t.labelMedium?.copyWith(color: SuColors.soft))
              else
                SuSelect<String>(label: d.ag.voterEnTantQue, value: _identite, options: identites.map((i) => i.$1).toList(), labelOf: (v) => identites.firstWhere((i) => i.$1 == v).$2, onChanged: (v) => setState(() { _identite = v; _choix = null; })),
              const SizedBox(height: 24),
              if (voteFait != null || r.resultat != 'EN_ATTENTE')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(color: SuColors.okTint, borderRadius: BorderRadius.circular(14)),
                  child: Row(
                    children: [
                      Container(width: 32, height: 32, decoration: const BoxDecoration(color: SuColors.ok, shape: BoxShape.circle), child: const Icon(Icons.check_rounded, color: Colors.white, size: 16)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: voteFait != null
                            ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d.ag.voteEnregistre, style: t.titleSmall), Text('${d.enums.valeurVote[voteFait]} · ${d.ag.voteImmuable}', style: t.labelSmall)])
                            : Text(d.ag.dejaVote, style: t.titleSmall),
                      ),
                    ],
                  ),
                )
              else ...[
                for (final v in const [('POUR', SuColors.ok), ('CONTRE', SuColors.danger), ('ABSTENTION', SuColors.hairlineStrong)])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: SizedBox(
                      height: 56,
                      child: OutlinedButton(
                        onPressed: peutVoter ? () => setState(() => _choix = v.$1) : null,
                        style: OutlinedButton.styleFrom(
                          backgroundColor: _choix == v.$1 ? (v.$1 == 'ABSTENTION' ? SuColors.ink : v.$2) : SuColors.surface,
                          foregroundColor: _choix == v.$1 ? Colors.white : (v.$1 == 'ABSTENTION' ? SuColors.body : v.$2),
                          side: BorderSide(color: _choix == v.$1 && v.$1 == 'ABSTENTION' ? SuColors.ink : v.$2, width: 2),
                          textStyle: t.titleMedium,
                        ),
                        child: Text(d.enums.valeurVote[v.$1] ?? v.$1),
                      ),
                    ),
                  ),
                if (_fail != null) ...[
                  _fail!.error.code == 'CONFLICT' ? Text(d.ag.dejaVote, style: t.bodySmall?.copyWith(color: SuColors.warn)) : FormError(_fail),
                  const SizedBox(height: 12),
                ],
                SubmitButton(label: md.registerVote, loading: _loading, onPressed: _choix == null ? null : () => _confirmer(r)),
                const SizedBox(height: 10),
                Text(d.ag.voteImmuable, style: t.labelSmall),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(d.ag.voteAnonymeNote, style: t.labelSmall, textAlign: TextAlign.center),
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
          const SizedBox(height: 10),
          FilledButton.icon(onPressed: () => context.pushReplacement('/ag/${ag.id}/pv'), icon: const Icon(Icons.gavel_rounded), label: Text(d.ag.pv)),
        ] else if (r == null) ...[
          SuBanner(tone: BannerTone.warn, body: d.ag.aucuneResolution),
        ] else ...[
          Row(
            children: [
              IconButton(onPressed: _index > 0 ? () => setState(() { _index--; _fail = null; }) : null, icon: const Icon(Icons.chevron_left_rounded)),
              Expanded(child: Text('${d.ag.resolution} ${_index + 1} / ${rs.length}', textAlign: TextAlign.center, style: t.labelMedium)),
              IconButton(onPressed: _index < rs.length - 1 ? () => setState(() { _index++; _fail = null; }) : null, icon: const Icon(Icons.chevron_right_rounded)),
            ],
          ),
          SuCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [StatusBadge(d.enums.typeMajorite[r.typeMajorite] ?? r.typeMajorite, variant: BadgeVariant.info, small: true), const Spacer(), StatusBadge(d.enums.resultatResolution[r.resultat] ?? r.resultat, variant: resolutionVariant[r.resultat] ?? BadgeVariant.neutral, small: true)]),
                const SizedBox(height: 10),
                Text(r.texte, style: t.titleMedium),
                const SizedBox(height: 6),
                Text(d.enums.typeMajoriteAide[r.typeMajorite] ?? '', style: t.bodySmall),
              ],
            ),
          ),
          SectionHeader(md.liveResults, subtitle: d.ag.resultats),
          SuCard(child: ResultatsWidget(agId: ag.id, resolution: r)),
          const SizedBox(height: 12),
          SuBanner(tone: BannerTone.info, body: md.pupitreRule),
          const SizedBox(height: 14),
          FormError(_fail),
          if (_fail != null) const SizedBox(height: 10),
          if (r.resultat == 'EN_ATTENTE')
            SubmitButton(
              label: '${d.ag.finaliser} · ${d.ag.resolution} ${r.ordre}',
              loading: _loading,
              icon: Icons.check_rounded,
              onPressed: () async {
                final ok = await confirmDialog(context, title: d.ag.finaliser, body: d.ag.finaliserCorps, irreversible: true);
                if (!ok) return;
                setState(() {
                  _loading = true;
                  _fail = null;
                });
                final res = await ref.read(apiClientProvider).post<AgResolution>('/ag/${ag.id}/resolutions/${r.id}/finaliser', parse: (j) => AgResolution.fromJson(asMap(j)));
                if (!mounted) return;
                setState(() => _loading = false);
                if (res is ApiFail<AgResolution>) {
                  setState(() => _fail = res);
                  return;
                }
                ref.invalidate(agProvider(ag.id));
                showToast(context, '${d.enums.resultatResolution[(res as ApiOk<AgResolution>).data.resultat]}${res.data.resultat == 'REJETEE' ? ' · ${d.ag.egaliteRejetee}' : ''}');
              },
            )
          else if (_index < rs.length - 1)
            OutlinedButton(onPressed: () => setState(() => _index++), child: Text(d.ag.resolutionSuivante)),
          const SizedBox(height: 24),
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
                    if (!mounted) return;
                    if (res is ApiFail) {
                      setState(() => _fail = res);
                      return;
                    }
                    ref.invalidate(agProvider(ag.id));
                    ref.invalidate(agListProvider);
                    context.pushReplacement('/ag/${ag.id}/pv');
                  },
          ),
          const SizedBox(height: 6),
          Text(enAttente > 0 ? fill(d.ag.restentEnAttente, {'n': enAttente}) : d.ag.cloturerCorps, style: t.labelSmall, textAlign: TextAlign.center),
        ],
      ],
    );
  }
}
