import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import '../../offline/sync_queue/visites_sync.dart';
import '../shell/app_shell.dart';

/// H2 (gardien, hors-ligne assumé, file de sync visible) / H3 (résident : répondre).
class VisitesScreen extends ConsumerStatefulWidget {
  const VisitesScreen({super.key, this.enregistrer = false});
  final bool enregistrer;
  @override
  ConsumerState<VisitesScreen> createState() => _VisitesScreenState();
}

class _VisitesScreenState extends ConsumerState<VisitesScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.enregistrer) WidgetsBinding.instance.addPostFrameCallback((_) => _enregistrer());
    // Cache de lecture : les lots servent au formulaire et aux libellés hors-ligne.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final sync = ref.read(visitesSyncProvider.notifier);
      final cached = await sync.cachedLots();
      final visitesCache = await sync.cachedJson('visites');
      if (mounted) {
        setState(() {
          _lotsCache = {for (final x in cached) x.id: x.numero};
          if (visitesCache is List) _visitesCache = visitesCache.whereType<Map>().map((m) => Visite.fromJson(m.cast<String, dynamic>())).toList();
        });
      }
      final lots = await ref.read(lotsProvider.future).catchError((_) => <Lot>[]);
      if (lots.isNotEmpty) sync.cacheLots(lots);
    });
  }

  Map<String, String> _lotsCache = const {};
  List<Visite> _visitesCache = const [];

  Future<void> _enregistrer() async {
    await showFormSheet<void>(context, title: context.dict.visites.enregistrer, builder: (_) => const _VisiteForm());
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final visites = ref.watch(visitesProvider);
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final queue = ref.watch(visitesQueueProvider).valueOrNull ?? const [];
    final sync = ref.watch(visitesSyncProvider);
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final lotNum = {..._lotsCache, for (final x in lots) x.id: x.numero};
    final gardien = ctx.isGardien;
    final gestion = ctx.isGestion;
    final resident = !gardien && !gestion && !ctx.isConseil;
    final mesLots = lots.where((x) => x.concerne(ctx.profil.id)).map((x) => x.id).toSet();
    final racine = !context.canPop();

    Widget carte(Visite v) {
      final peutRepondre = v.statut == 'EN_ATTENTE' && resident && mesLots.contains(v.lotId);
      return ListRow(
        leading: Avatar(v.visiteurNom, size: 40),
        title: peutRepondre ? fill(d.visites.demandeAcces, {'nom': v.visiteurNom, 'lot': lotNum[v.lotId] ?? '—'}) : '${v.visiteurNom} → ${lotNum[v.lotId] ?? '—'}',
        subtitle: '${formatHeure(v.horodatage, l)} · ${md.synced}',
        trailing: peutRepondre ? StatusBadge(d.visites.autoriser, variant: BadgeVariant.info) : StatusBadge(d.enums.statutVisite[v.statut] ?? v.statut, variant: visiteVariant[v.statut] ?? BadgeVariant.neutral, pulse: v.statut == 'EN_ATTENTE', small: true),
        onTap: peutRepondre ? () => context.push('/visites/${v.id}') : null,
      );
    }

    return Scaffold(
      appBar: racine ? ShellHeader(title: resident ? d.visites.mesVisites : d.visites.titre) : AppBar(title: Text(resident ? d.visites.mesVisites : d.visites.titre)),
      floatingActionButton: (gardien || gestion) ? FloatingActionButton.extended(onPressed: _enregistrer, backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.person_add_alt_1_rounded), label: Text(d.visites.enregistrer)) : null,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(visitesProvider);
          await ref.read(visitesSyncProvider.notifier).flush();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            if (gardien || gestion) ...[
              Row(children: [
                StatusBadge(online ? md.online : md.offline, variant: online ? BadgeVariant.ok : BadgeVariant.warn, small: true),
                const SizedBox(width: 8),
                if (sync.syncing) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 10),
                Expanded(child: Text(md.worksOffline, style: t.labelSmall, textAlign: TextAlign.end, maxLines: 2, overflow: TextOverflow.ellipsis)),
              ]),
              const SizedBox(height: 10),
            ],
            if (queue.isNotEmpty) ...[
              SuCard(
                border: SuColors.warnBorder,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [Expanded(child: Text(fill(md.queueTitle, {'n': queue.length}), style: t.titleSmall)), Text(md.queueLocal, style: t.labelSmall?.copyWith(color: SuColors.warn, fontFamily: 'GeistMono'))]),
                    const SizedBox(height: 10),
                    for (final q in queue)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Container(width: 9, height: 9, decoration: BoxDecoration(color: q.statut == 'ECHEC_DEFINITIF' ? SuColors.danger : SuColors.warn, shape: BoxShape.circle)),
                            const SizedBox(width: 10),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${q.visiteurNom} → ${q.lotNumero ?? lotNum[q.lotId] ?? '—'}', style: t.bodyMedium?.copyWith(color: SuColors.ink, fontWeight: FontWeight.w500)), Text('${formatHeure(q.creeLe.toIso8601String(), l)} · ${q.statut == 'ECHEC_DEFINITIF' ? md.failedDefinitive : md.pendingSend}', style: t.labelSmall)])),
                            if (q.statut == 'ECHEC_DEFINITIF') IconButton(onPressed: () => ref.read(visitesSyncProvider.notifier).retirer(q.id), icon: const Icon(Icons.delete_outline_rounded, color: SuColors.faint), tooltip: md.remove),
                          ],
                        ),
                      ),
                    Text(md.queueHint, style: t.labelSmall),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(onPressed: () => ref.read(visitesSyncProvider.notifier).flush(), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)), icon: const Icon(Icons.sync_rounded, size: 18), label: Text(md.retryNow)),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (visites.hasError && _visitesCache.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 10), child: SuBanner(tone: BannerTone.warn, body: md.offlineCached)),
            AsyncView(visites.hasError && _visitesCache.isNotEmpty ? AsyncData(_visitesCache) : visites, onRetry: () => ref.invalidate(visitesProvider), data: (list) {
              if (visites.hasValue) ref.read(visitesSyncProvider.notifier).cacheJson('visites', list.map(_visiteJson).toList());
              if (list.isEmpty && queue.isEmpty) return EmptyState(title: d.visites.aucuneVisite, hint: gardien || gestion ? d.visites.aucuneVisiteAide : null, icon: Icons.meeting_room_rounded);
              final sorted = [...list]..sort((a, b) => b.horodatage.compareTo(a.horodatage));
              final duJour = sorted.where((v) => estAujourdhui(v.horodatage)).toList();
              final histo = sorted.where((v) => !estAujourdhui(v.horodatage)).toList();
              final attente = sorted.where((v) => v.statut == 'EN_ATTENTE').toList();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (gardien || gestion)
                    TwoCols([
                      StatTile(label: d.visites.duJour, value: '${duJour.length}', tone: Tone.sand, icon: Icons.meeting_room_rounded),
                      StatTile(label: d.enums.statutVisite['EN_ATTENTE']!, value: '${attente.length}', tone: Tone.warn, icon: Icons.notifications_active_rounded),
                    ]),
                  if (duJour.isNotEmpty) ...[SectionHeader(d.visites.duJour), CardList([for (final v in duJour) carte(v)])],
                  if (histo.isNotEmpty) ...[SectionHeader(d.visites.historique), CardList([for (final v in histo.take(50)) carte(v)])],
                ],
              );
            }),
          ],
        ),
      ),
    );
  }
}

Map<String, dynamic> _visiteJson(Visite v) => {'id': v.id, 'coproprieteId': v.coproprieteId, 'gardienId': v.gardienId, 'lotId': v.lotId, 'visiteurNom': v.visiteurNom, 'statut': v.statut, 'horodatage': v.horodatage};

/// Formulaire d'enregistrement — écriture optimiste via la file locale.
class _VisiteForm extends ConsumerStatefulWidget {
  const _VisiteForm();
  @override
  ConsumerState<_VisiteForm> createState() => _VisiteFormState();
}

class _VisiteFormState extends ConsumerState<_VisiteForm> {
  final _nom = TextEditingController();
  String? _lot;
  List<({String id, String numero})> _lots = const [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _chargerLots();
  }

  Future<void> _chargerLots() async {
    final live = ref.read(lotsProvider).valueOrNull;
    if (live != null && live.isNotEmpty) {
      setState(() => _lots = live.map((x) => (id: x.id, numero: x.numero)).toList());
      return;
    }
    final cached = await ref.read(visitesSyncProvider.notifier).cachedLots();
    if (mounted) setState(() => _lots = cached);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.visites.visiteurNom, controller: _nom, required: true, autofocus: true, textInputAction: TextInputAction.next),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.visites.lotVisite, value: _lot, options: _lots.map((x) => x.id).toList(), labelOf: (id) => _lots.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true, placeholder: md.selectLot),
        const SizedBox(height: 10),
        Text(md.worksOffline, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 14),
        SubmitButton(
          label: d.visites.enregistrer,
          loading: _loading,
          onPressed: _lot == null || _nom.text.trim().isEmpty && false
              ? null
              : () async {
                  if (_nom.text.trim().isEmpty) return;
                  setState(() => _loading = true);
                  final v = await ref.read(visitesSyncProvider.notifier).enregistrer(lotId: _lot!, lotNumero: _lots.where((x) => x.id == _lot).map((x) => x.numero).firstOrNull, visiteurNom: _nom.text.trim());
                  if (!mounted) return;
                  ref.invalidate(visitesProvider);
                  Navigator.pop(context);
                  showToast(context, v == null ? md.pendingSend : d.visites.enregistree);
                },
        ),
      ],
    );
  }
}

/// H3 — écran plein cadre « visiteur à votre porte » : deux réponses, une seule fois.
class VisiteRepondreScreen extends ConsumerStatefulWidget {
  const VisiteRepondreScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<VisiteRepondreScreen> createState() => _VisiteRepondreScreenState();
}

class _VisiteRepondreScreenState extends ConsumerState<VisiteRepondreScreen> {
  bool _loading = false;
  ApiFail? _fail;
  String? _reponse;

  Future<void> _repondre(String statut) async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final r = await ref.read(apiClientProvider).patch<dynamic>('/visites/${widget.id}/statut', body: {'statut': statut});
    if (!mounted) return;
    if (r is ApiFail) {
      setState(() {
        _loading = false;
        _fail = r;
      });
      return;
    }
    ref.invalidate(visitesProvider);
    setState(() {
      _loading = false;
      _reponse = statut;
    });
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final visites = ref.watch(visitesProvider);
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final v = visites.valueOrNull?.where((x) => x.id == widget.id).firstOrNull;
    return Scaffold(
      backgroundColor: SuColors.surface,
      appBar: AppBar(backgroundColor: SuColors.surface),
      body: SafeArea(
        child: visites.isLoading && v == null
            ? const Center(child: CircularProgressIndicator())
            : v == null
                ? Padding(padding: const EdgeInsets.all(16), child: ErrorState(error: visites.error ?? const ApiException(ApiError(code: 'NOT_FOUND', message: ''), 404), onRetry: () => ref.invalidate(visitesProvider)))
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      children: [
                        const Spacer(),
                        Text(md.doorTitle.toUpperCase(), style: t.labelSmall?.copyWith(letterSpacing: 1.2, color: SuColors.warn)),
                        const SizedBox(height: 18),
                        Avatar(v.visiteurNom, size: 96),
                        const SizedBox(height: 18),
                        Text(v.visiteurNom, style: t.displayMedium, textAlign: TextAlign.center),
                        const SizedBox(height: 6),
                        Text(fill(md.doorBody, {'lot': lots.where((x) => x.id == v.lotId).map((x) => x.numero).firstOrNull ?? ''}), style: t.bodyLarge, textAlign: TextAlign.center),
                        const SizedBox(height: 6),
                        Text(fill(md.registeredBy, {'heure': formatHeure(v.horodatage, l)}), style: t.labelSmall),
                        const Spacer(),
                        if (_reponse != null || v.statut != 'EN_ATTENTE') ...[
                          SuBanner(tone: (_reponse ?? v.statut) == 'AUTORISE' ? BannerTone.ok : BannerTone.danger, title: d.visites.reponseDonnee, body: d.enums.statutVisite[_reponse ?? v.statut] ?? ''),
                          const SizedBox(height: 12),
                          OutlinedButton(onPressed: () => context.canPop() ? context.pop() : context.go('/tableau-de-bord'), child: Text(d.common.close)),
                        ] else ...[
                          if (_fail != null) ...[_fail!.status == 422 ? SuBanner(tone: BannerTone.warn, body: d.visites.dejaRepondu) : FormError(_fail), const SizedBox(height: 12)],
                          Text(d.visites.reponseUnique, style: t.bodySmall, textAlign: TextAlign.center),
                          const SizedBox(height: 14),
                          SizedBox(height: 60, child: FilledButton.icon(onPressed: _loading ? null : () => _repondre('AUTORISE'), style: FilledButton.styleFrom(backgroundColor: SuColors.ok), icon: const Icon(Icons.check_rounded), label: Text(d.visites.autoriser))),
                          const SizedBox(height: 10),
                          SizedBox(height: 60, child: OutlinedButton.icon(onPressed: _loading ? null : () => _repondre('REFUSE'), style: OutlinedButton.styleFrom(foregroundColor: SuColors.danger, side: const BorderSide(color: SuColors.danger)), icon: const Icon(Icons.close_rounded), label: Text(d.visites.refuser))),
                        ],
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
      ),
    );
  }
}
