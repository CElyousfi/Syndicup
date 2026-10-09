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
import '../parkings/parkings_screens.dart' show PlaceVisiteurSheet;

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

    // M23 — place visiteur (gardien pour ses visites du jour, syndic) : plaque + heure limite.
    final aujourdhui = DateTime.now();
    bool duJourLocal(Visite v) { final h = DateTime.tryParse(v.horodatage)?.toLocal(); return h != null && h.year == aujourdhui.year && h.month == aujourdhui.month && h.day == aujourdhui.day; }
    Future<void> place(Visite v) async {
      final ok = await showFormSheet<bool>(context, title: d.parkings.attribuerPlace, builder: (_) => PlaceVisiteurSheet(visite: v));
      if (ok == true) { ref.invalidate(visitesProvider); ref.invalidate(visiteursAujourdhuiProvider); ref.invalidate(placesVisiteursProvider); }
    }
    Widget carte(Visite v) {
      final peutRepondre = v.statut == 'EN_ATTENTE' && resident && mesLots.contains(v.lotId);
      final peutPlacer = (gardien || gestion) && duJourLocal(v);
      final placeTexte = v.emplacementId != null ? '${d.parkings.placeVisiteur} ${_codePlace(ref, v.emplacementId!)}${v.immatriculation != null ? ' · ${v.immatriculation}' : ''}' : null;
      return ListRow(
        leading: Avatar(v.visiteurNom, size: 48),
        title: peutRepondre ? fill(d.visites.demandeAcces, {'nom': v.visiteurNom, 'lot': lotNum[v.lotId] ?? '—'}) : '${v.visiteurNom} → ${lotNum[v.lotId] ?? '—'}',
        subtitle: '${formatHeure(v.horodatage, l)} · ${md.synced}${placeTexte != null ? ' · $placeTexte' : ''}',
        trailing: peutRepondre
            ? StatusBadge(d.visites.autoriser, variant: BadgeVariant.info)
            : peutPlacer
                // Place visiteur : grande cible ronde, verte une fois la place attribuée.
                ? CircleIconButton(onTap: () => place(v), icon: v.emplacementId != null ? Icons.local_parking_rounded : Icons.add_location_alt_rounded, iconColor: v.emplacementId != null ? SuColors.ok : SuColors.link, tooltip: d.parkings.attribuerPlace)
                : StatusBadge(d.enums.statutVisite[v.statut] ?? v.statut, variant: visiteVariant[v.statut] ?? BadgeVariant.neutral, pulse: v.statut == 'EN_ATTENTE', small: true),
        onTap: peutRepondre ? () => context.push('/visites/${v.id}') : null,
      );
    }

    final titre = resident ? d.visites.mesVisites : d.visites.titre;
    final fab = (gardien || gestion) ? FloatingActionButton.extended(onPressed: _enregistrer, icon: const Icon(Icons.person_add_alt_1_rounded), label: Text(d.visites.enregistrer)) : null;
    Future<void> refresh() async {
      ref.invalidate(visitesProvider);
      await ref.read(visitesSyncProvider.notifier).flush();
    }

    final contenu = <Widget>[
      // Réseau : état lisible d'un coup d'œil (le gardien travaille souvent sans réseau).
      if (gardien || gestion) ...[StatutReseauTile(online: online, syncing: sync.syncing, hint: md.worksOffline), const SizedBox(height: 12)],
      if (queue.isNotEmpty) ...[
        SuCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                const IconCircle(Icons.cloud_upload_rounded, tone: Tone.warn),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(fill(md.queueTitle, {'n': queue.length}), style: t.titleMedium), Text(md.queueLocal, style: t.labelSmall?.copyWith(color: SuColors.warn, fontFamily: 'GeistMono'))])),
              ]),
              const SizedBox(height: 12),
              for (final q in queue)
                Padding(
                  key: ValueKey(q.id),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Container(width: 10, height: 10, decoration: BoxDecoration(color: q.statut == 'ECHEC_DEFINITIF' ? SuColors.danger : SuColors.warn, shape: BoxShape.circle)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${q.visiteurNom} → ${q.lotNumero ?? lotNum[q.lotId] ?? '—'}', style: t.titleSmall), Text('${formatHeure(q.creeLe.toIso8601String(), l)} · ${q.statut == 'ECHEC_DEFINITIF' ? md.failedDefinitive : md.pendingSend}', style: t.bodySmall)])),
                      if (q.statut == 'ECHEC_DEFINITIF') CircleIconButton(onTap: () => ref.read(visitesSyncProvider.notifier).retirer(q.id), icon: Icons.delete_outline_rounded, color: SuColors.surface, iconColor: SuColors.danger, size: 40, tooltip: md.remove),
                    ],
                  ),
                ),
              const SizedBox(height: 6),
              Text(md.queueHint, style: t.bodySmall),
              const SizedBox(height: 14),
              SuButton(label: md.retryNow, icon: Icons.sync_rounded, variant: SuButtonVariant.secondary, onPressed: () => ref.read(visitesSyncProvider.notifier).flush()),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
      if (visites.hasError && _visitesCache.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 10), child: SuBanner(tone: BannerTone.warn, body: md.offlineCached)),
      AsyncView(visites.hasError && _visitesCache.isNotEmpty ? AsyncData(_visitesCache) : visites, onRetry: () => ref.invalidate(visitesProvider), data: (list) {
        if (visites.hasValue) ref.read(visitesSyncProvider.notifier).cacheJson('visites', list.map(_visiteJson).toList());
        if (list.isEmpty && queue.isEmpty) return EmptyState(title: d.visites.aucuneVisite, hint: gardien || gestion ? d.visites.aucuneVisiteAide : null, icon: Icons.meeting_room_rounded, illustration: 'empty-visites');
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
            if (duJour.isNotEmpty) ...[SectionHeader(d.visites.duJour), CardList([for (final v in duJour) KeyedSubtree(key: ValueKey(v.id), child: carte(v))])],
            if (histo.isNotEmpty) ...[SectionHeader(d.visites.historique), CardList([for (final v in histo.take(50)) KeyedSubtree(key: ValueKey(v.id), child: carte(v))])],
          ],
        );
      }),
    ];

    // Écran racine (onglet) : en-tête de la coque ; poussé depuis l'accueil : page Wise (retour rond, grand titre).
    if (!racine) return SuPage(title: titre, onRefresh: refresh, fab: fab, padding: const EdgeInsets.fromLTRB(16, 0, 16, 112), children: contenu);
    return Scaffold(
      appBar: ShellHeader(title: titre),
      floatingActionButton: fab,
      body: SuRefresh(
        onRefresh: refresh,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 112), physics: const AlwaysScrollableScrollPhysics(), children: contenu),
      ),
    );
  }
}

/// Tuile « réseau » (visites, location courte durée) : en ligne = pastille verte discrète ;
/// hors-ligne = tuile sable bien visible. Synchronisation en cours = indicateur à la fin.
class StatutReseauTile extends StatelessWidget {
  const StatutReseauTile({super.key, required this.online, required this.syncing, required this.hint});
  final bool online, syncing;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    return Semantics(
      liveRegion: true,
      child: SuCard(
        color: online ? null : SuColors.sandTint,
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            IconCircle(online ? Icons.wifi_rounded : Icons.wifi_off_rounded, tone: online ? Tone.ok : Tone.warn),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(online ? md.online : md.offline, style: t.titleMedium?.copyWith(color: online ? SuColors.ink : SuColors.warn)),
                  const SizedBox(height: 2),
                  Text(hint, style: t.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            if (syncing) ...[const SizedBox(width: 12), const SizedBox(width: 22, height: 22, child: Center(child: LoadingOrb(size: 8, color: SuColors.link)))],
          ],
        ),
      ),
    );
  }
}

/// Message de succès « Titre. Détail » → titre d'affiche + corps (repli : tout en titre).
({String title, String? body}) _scinder(String s) {
  final i = s.indexOf('. ');
  if (i <= 0) return (title: s.endsWith('.') ? s.substring(0, s.length - 1) : s, body: null);
  return (title: s.substring(0, i), body: s.substring(i + 2).trim());
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
    final t = Theme.of(context).textTheme;
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.visites.visiteurNom, controller: _nom, required: true, autofocus: true, textInputAction: TextInputAction.next),
        const SizedBox(height: 16),
        SuSelect<String>(label: d.visites.lotVisite, value: _lot, options: _lots.map((x) => x.id).toList(), labelOf: (id) => _lots.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true, placeholder: md.selectLot),
        const SizedBox(height: 14),
        // Hors-ligne assumé : l'enregistrement part dans la file locale.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(online ? Icons.cloud_done_rounded : Icons.wifi_off_rounded, size: 20, color: online ? SuColors.ok : SuColors.warn),
            const SizedBox(width: 10),
            Expanded(child: Text(md.worksOffline, style: t.bodySmall)),
          ],
        ),
        const SizedBox(height: 20),
        SubmitButton(
          label: d.visites.enregistrer,
          icon: Icons.person_add_alt_1_rounded,
          loading: _loading,
          onPressed: _lot == null || _nom.text.trim().isEmpty && false
              ? null
              : () async {
                  if (_nom.text.trim().isEmpty) return;
                  setState(() => _loading = true);
                  final v = await ref.read(visitesSyncProvider.notifier).enregistrer(lotId: _lot!, lotNumero: _lots.where((x) => x.id == _lot).map((x) => x.numero).firstOrNull, visiteurNom: _nom.text.trim());
                  if (!context.mounted) return;
                  // Contexte encore monté après la fermeture de la feuille : le navigateur racine.
                  final racine = Navigator.of(context, rootNavigator: true).context;
                  ref.invalidate(visitesProvider);
                  Navigator.pop(context);
                  if (v == null) {
                    showToast(context, md.pendingSend);
                  } else {
                    final m = _scinder(d.visites.enregistree);
                    showSuccess(racine, title: m.title, body: m.body, illustration: 'ok-visiteur');
                  }
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
    void fermer() => context.canPop() ? context.pop() : context.go('/tableau-de-bord');
    final reponse = _reponse ?? v?.statut;
    final autorise = reponse == 'AUTORISE';
    return Scaffold(
      backgroundColor: SuColors.surface,
      appBar: AppBar(
        backgroundColor: SuColors.surface,
        toolbarHeight: 64,
        automaticallyImplyLeading: false,
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsetsDirectional.only(start: 16),
          child: Align(alignment: AlignmentDirectional.centerStart, child: CircleIconButton(icon: Icons.close_rounded, tooltip: d.common.close, onTap: fermer)),
        ),
      ),
      body: SafeArea(
        top: false,
        child: visites.isLoading && v == null
            ? const Padding(padding: EdgeInsets.fromLTRB(24, 24, 24, 16), child: LoadingList(count: 3))
            : v == null
                ? Padding(padding: const EdgeInsets.all(16), child: ErrorState(error: visites.error ?? const ApiException(ApiError(code: 'NOT_FOUND', message: ''), 404), onRetry: () => ref.invalidate(visitesProvider)))
                : Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Spacer(),
                        // Moment « porte » : grand avatar, nom en très grand, demande en clair.
                        Center(
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              SuEnter(child: Avatar(v.visiteurNom, size: 112)),
                              if (v.statut != 'EN_ATTENTE' || _reponse != null)
                                PositionedDirectional(
                                  end: -4,
                                  bottom: -4,
                                  child: Container(
                                    padding: const EdgeInsets.all(3),
                                    decoration: const BoxDecoration(color: SuColors.surface, shape: BoxShape.circle),
                                    child: IconCircle(autorise ? Icons.check_rounded : Icons.close_rounded, tone: autorise ? Tone.ok : Tone.danger, size: 40, iconSize: 22),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 22),
                        Center(child: StatusBadge(md.doorTitle, variant: v.statut == 'EN_ATTENTE' && _reponse == null ? BadgeVariant.warn : BadgeVariant.neutral, pulse: v.statut == 'EN_ATTENTE' && _reponse == null)),
                        const SizedBox(height: 14),
                        Text(v.visiteurNom, style: t.displayMedium, textAlign: TextAlign.center),
                        const SizedBox(height: 8),
                        Text(fill(md.doorBody, {'lot': lots.where((x) => x.id == v.lotId).map((x) => x.numero).firstOrNull ?? ''}), style: t.bodyLarge?.copyWith(color: SuColors.body), textAlign: TextAlign.center),
                        const SizedBox(height: 6),
                        Text(fill(md.registeredBy, {'heure': formatHeure(v.horodatage, l)}), style: t.bodySmall, textAlign: TextAlign.center),
                        const Spacer(),
                        if (_reponse != null || v.statut != 'EN_ATTENTE') ...[
                          SuBanner(tone: autorise ? BannerTone.ok : BannerTone.danger, title: d.visites.reponseDonnee, body: d.enums.statutVisite[reponse] ?? ''),
                          const SizedBox(height: 16),
                          SuButton(label: d.common.close, onPressed: fermer, size: SuButtonSize.lg, expand: true),
                        ] else ...[
                          if (_fail != null) ...[_fail!.status == 422 ? SuBanner(tone: BannerTone.warn, body: d.visites.dejaRepondu) : FormError(_fail), const SizedBox(height: 12)],
                          Text(d.visites.reponseUnique, style: t.bodySmall, textAlign: TextAlign.center),
                          const SizedBox(height: 16),
                          // Deux réponses, grandes cibles : autoriser (pill principale), refuser (contour rouge).
                          SuButton(label: d.visites.autoriser, icon: Icons.check_rounded, expand: true, onPressed: _loading ? null : () => _repondre('AUTORISE'), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(60))),
                          const SizedBox(height: 10),
                          SuButton(label: d.visites.refuser, icon: Icons.close_rounded, variant: SuButtonVariant.secondary, expand: true, onPressed: _loading ? null : () => _repondre('REFUSE'), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(60), foregroundColor: SuColors.danger, side: const BorderSide(color: SuColors.danger, width: 1.2))),
                        ],
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
      ),
    );
  }
}

String _codePlace(WidgetRef ref, String id) => ref.watch(placesVisiteursProvider).valueOrNull?.where((p) => p.id == id).map((p) => p.code).firstOrNull ?? '';
