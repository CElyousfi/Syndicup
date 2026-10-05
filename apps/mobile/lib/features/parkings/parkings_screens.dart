import 'dart:convert';

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
import '../incidents/incidents_screens.dart' show scinderMessage;
import '../../offline/sync_queue/visites_sync.dart' show localDatabaseProvider, connectivityProvider;

const _cachePlaques = 'parkings:plaques-actives';

/// Parkings & badges (M23) — résident : ses emplacements, véhicules, badges ; gardien : plan,
/// places visiteurs du jour, recherche de plaque (cache hors-ligne) ; gestion / conseil : lecture
/// (la gestion fine — création, attribution, remise de badge — est web-first, docs/PARITE_WEB_MOBILE.md).
class ParkingsScreen extends ConsumerStatefulWidget {
  const ParkingsScreen({super.key, this.onglet});
  final String? onglet;
  @override
  ConsumerState<ParkingsScreen> createState() => _ParkingsScreenState();
}

class _ParkingsScreenState extends ConsumerState<ParkingsScreen> with TickerProviderStateMixin {
  late List<String> _onglets;
  TabController? _tabs;

  List<String> _ongletsPour(AppContext ctx) => ctx.isResident
      ? const ['plan', 'vehicules', 'badges']
      : ctx.isGardien
          ? const ['visiteurs', 'plan', 'vehicules', 'badges']
          : const ['plan', 'vehicules', 'badges', 'visiteurs'];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final ctx = ref.read(appContextProvider);
    final onglets = _ongletsPour(ctx);
    if (_tabs == null || _onglets.length != onglets.length) {
      _onglets = onglets;
      _tabs?.dispose();
      final i = onglets.indexOf(widget.onglet ?? '');
      _tabs = TabController(length: onglets.length, vsync: this, initialIndex: i < 0 ? 0 : i);
    }
  }

  @override
  void dispose() {
    _tabs?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final t = d.parkings;
    final racine = !context.canPop();
    final titre = t.titre;
    final bar = TabBar(controller: _tabs, isScrollable: true, tabAlignment: TabAlignment.start, tabs: [for (final o in _onglets) Tab(text: switch (o) { 'plan' => t.onglets.plan, 'vehicules' => t.onglets.vehicules, 'badges' => t.onglets.badges, _ => t.onglets.visiteurs })]);
    final vues = TabBarView(controller: _tabs, children: [
      for (final o in _onglets)
        switch (o) {
          'plan' => _PlanTab(resident: ctx.isResident),
          'vehicules' => _VehiculesTab(ctx: ctx),
          'badges' => _BadgesTab(ctx: ctx),
          _ => const _VisiteursTab(),
        },
    ]);
    // Hors racine : page Wise (retour rond, titre compact, onglets dessous).
    if (!racine) return SuPage(title: titre, bottom: bar, body: vues);
    return Scaffold(appBar: ShellHeaderWithBottom(title: titre, bottom: bar), body: vues);
  }
}

/// En-tête du shell avec onglets (route racine « Plus » → parkings).
class ShellHeaderWithBottom extends StatelessWidget implements PreferredSizeWidget {
  const ShellHeaderWithBottom({super.key, required this.title, required this.bottom});
  final String title;
  final PreferredSizeWidget bottom;
  @override
  Size get preferredSize => Size.fromHeight(kToolbarHeight + bottom.preferredSize.height);
  @override
  Widget build(BuildContext context) => AppBar(title: Text(title), automaticallyImplyLeading: false, bottom: bottom);
}

// ── Plan ─────────────────────────────────────────────────────────────────────
class _PlanTab extends ConsumerWidget {
  const _PlanTab({required this.resident});
  final bool resident;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = d.parkings;
    final e = d.enumsParkings;
    final l = context.locale;
    final tt = Theme.of(context).textTheme;
    final plan = ref.watch(planEmplacementsProvider);
    final mes = resident ? ref.watch(attributionsProvider('')) : const AsyncValue<List<AttributionEmplacement>>.data([]);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(planEmplacementsProvider);
        ref.invalidate(attributionsProvider);
      },
      color: SuColors.link,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
        Text(resident ? t.subtitleResident : t.subtitle, style: tt.bodyLarge?.copyWith(color: SuColors.soft)),
        if (resident) ...[
          SectionHeader(t.onglets.mesAttributions),
          AsyncView(mes, onRetry: () => ref.invalidate(attributionsProvider), data: (rows) => rows.isEmpty
              ? SuCard(child: Text(t.aucunEmplacementResident, style: tt.bodySmall))
              : CardList([
                  for (final a in rows)
                    ListRow(
                      leading: IconCircle(Icons.local_parking_rounded, tone: a.active ? Tone.ok : Tone.neutral),
                      title: '${a.emplacementCode} · ${t.lot} ${a.lotNumero ?? '—'}',
                      subtitle: '${e.typeAttribution[a.type] ?? a.type} · ${formatJourAnnee(a.dateDebut, l)} → ${a.dateFin != null ? formatJourAnnee(a.dateFin, l) : t.sansFin}${a.redevanceMensuelle != null ? ' · ${formatMAD(a.redevanceMensuelle, l)}' : ''}',
                      trailing: StatusBadge(a.active ? t.active : t.terminee, variant: a.active ? BadgeVariant.ok : BadgeVariant.neutral, small: true),
                    ),
                ])),
        ],
        AsyncView(plan, onRetry: () => ref.invalidate(planEmplacementsProvider), data: (p) {
          if (p.niveaux.isEmpty) return EmptyState(title: t.aucunEmplacement, icon: Icons.local_parking_rounded, illustration: 'empty-parkings');
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (!resident) ...[
              const SizedBox(height: 16),
              // Soldes Wise : quatre tuiles greige, grand chiffre en bas.
              TwoCols([
                StatTile(label: t.total, value: '${p.total}', icon: Icons.local_parking_rounded, minHeight: 140),
                StatTile(label: t.attribues, value: '${p.attribues}', icon: Icons.key_rounded, tone: Tone.tosca, hint: '${p.disponibles} ${t.disponibles.toLowerCase()}', minHeight: 140),
                StatTile(label: t.visiteurs, value: '${p.visiteursOccupees}/${p.visiteurs}', icon: Icons.meeting_room_rounded, tone: p.visiteurs > 0 && p.visiteursOccupees >= p.visiteurs ? Tone.warn : Tone.sand, hint: t.visiteursOccupees, minHeight: 140),
                StatTile(label: t.horsService, value: '${p.horsService}', icon: Icons.block_rounded, tone: p.horsService > 0 ? Tone.warn : Tone.sage, minHeight: 140),
              ]),
            ],
            for (final n in p.niveaux) ...[
              SectionHeader(n.niveau == '—' ? t.sansNiveau : '${t.niveau} ${n.niveau}', subtitle: '${n.emplacements.length} · ${n.emplacements.where((x) => x.occupee).length} ${t.attribues.toLowerCase()}'),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.1,
                children: [for (final x in n.emplacements) CaseEmplacement(x, resident: resident)],
              ),
            ],
          ]);
        }),
      ]),
    );
  }
}

class CaseEmplacement extends StatelessWidget {
  const CaseEmplacement(this.x, {super.key, this.resident = false});
  final Emplacement x;
  final bool resident;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = d.parkings;
    final e = d.enumsParkings;
    final tt = Theme.of(context).textTheme;
    final hs = x.statut == 'HORS_SERVICE';
    // Tuiles plates (Wise) : la teinte seule porte l'état — attribuée tosca, visiteurs vert, libre greige, hors service voilée.
    final fond = hs ? SuColors.wash : x.occupee ? SuColors.toscaTint : x.type == 'PARKING_VISITEUR' ? SuColors.okTint : SuColors.tile;
    final etat = hs ? e.statutEmplacement['HORS_SERVICE']! : x.attributionCourante != null ? '${t.lot} ${x.attributionCourante!.lotNumero ?? '—'}' : x.statut == 'ATTRIBUE' ? e.statutEmplacement['ATTRIBUE']! : x.type == 'PARKING_VISITEUR' ? (x.visiteurOccupee ? t.visiteurOccupee : t.visiteurLibre) : (x.type == 'PARKING_PMR' || !x.attribuable) ? t.nonAttribuable : e.statutEmplacement['DISPONIBLE']!;
    return SuCard(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      radius: 20,
      color: fond,
      onTap: resident ? null : () => context.push('/parkings/${x.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(x.code, style: tt.titleLarge?.copyWith(fontFamily: 'GeistMono', color: hs ? SuColors.faint : SuColors.ink, decoration: hs ? TextDecoration.lineThrough : null), textDirection: TextDirection.ltr, maxLines: 1, overflow: TextOverflow.ellipsis),
        Text(e.typeEmplacement[x.type] ?? x.type, style: tt.labelSmall?.copyWith(fontSize: 10.5, color: SuColors.soft), maxLines: 1, overflow: TextOverflow.ellipsis),
        Text(etat, style: tt.bodySmall?.copyWith(color: hs ? SuColors.faint : SuColors.ink, fontSize: 12, fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
      ]),
    );
  }
}

// ── Emplacement (fiche lecture — gestion / conseil / gardien) ────────────────
class EmplacementDetailScreen extends ConsumerWidget {
  const EmplacementDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = d.parkings;
    final e = d.enumsParkings;
    final l = context.locale;
    final tt = Theme.of(context).textTheme;
    final emp = ref.watch(emplacementProvider(id));
    return SuPage(
      title: emp.valueOrNull?.code ?? t.titre,
      onRefresh: () async => ref.invalidate(emplacementProvider(id)),
      children: [
        AsyncView(emp, onRetry: () => ref.invalidate(emplacementProvider(id)), data: (x) {
        final c = x.attributionCourante;
        final aujourdhui = DateTime.now().toIso8601String().substring(0, 10);
        final hs = x.statut == 'HORS_SERVICE';
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Bloc résumé Wise : grande pastille, type, niveau, statuts.
          SuEnter(
            child: SuCard(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                IconCircle(hs ? Icons.block_rounded : Icons.local_parking_rounded, tone: hs ? Tone.warn : x.occupee ? Tone.tosca : Tone.ok, size: 64),
                const SizedBox(height: 18),
                Text(e.typeEmplacement[x.type] ?? x.type, style: tt.displaySmall),
                if (x.niveau != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${t.niveau} ${x.niveau}', style: tt.bodyMedium?.copyWith(color: SuColors.soft))),
                const SizedBox(height: 14),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  StatusBadge(e.statutEmplacement[x.statut] ?? x.statut, variant: emplacementVariant[x.statut] ?? BadgeVariant.neutral),
                  if (!x.attribuable) StatusBadge(t.nonAttribuable, variant: BadgeVariant.outline),
                ]),
              ]),
            ),
          ),
          SectionHeader(t.attributionCourante),
          c == null
              ? Text(t.aucuneAttribution, style: tt.bodyMedium?.copyWith(color: SuColors.soft))
              : SuCard(padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8), child: Column(children: [
                  KeyValueRow(t.lotBeneficiaire, c.lotNumero ?? '—'),
                  KeyValueRow(t.type, e.typeAttribution[c.type] ?? c.type),
                  KeyValueRow(t.periode, '${formatJourAnnee(c.dateDebut, l)} → ${c.dateFin != null ? formatJourAnnee(c.dateFin, l) : t.sansFin}'),
                  KeyValueRow(t.redevance, c.redevanceMensuelle != null ? formatMAD(c.redevanceMensuelle, l) : '—'),
                  if (c.notes != null) KeyValueRow(t.notes, c.notes!),
                ])),
          SectionHeader(t.historique),
          x.attributions.isEmpty
              ? Text(t.aucunHistorique, style: tt.bodyMedium?.copyWith(color: SuColors.soft))
              : CardList([
                  for (final a in x.attributions)
                    ListRow(
                      leading: IconCircle(Icons.history_rounded, tone: a.active ? Tone.ok : Tone.neutral),
                      title: '${t.lot} ${a.lotNumero ?? '—'} · ${e.typeAttribution[a.type] ?? a.type}',
                      subtitle: '${formatJourAnnee(a.dateDebut, l)} → ${a.dateFin != null ? formatJourAnnee(a.dateFin, l) : t.sansFin}${a.redevanceMensuelle != null ? ' · ${formatMAD(a.redevanceMensuelle, l)}' : ''}',
                      trailing: StatusBadge(a.active ? t.active : a.dateDebut.compareTo(aujourdhui) > 0 ? t.aVenir : t.terminee, variant: a.active ? BadgeVariant.ok : BadgeVariant.neutral, small: true),
                    ),
                ]),
          if (x.notes != null && x.notes!.isNotEmpty) ...[SectionHeader(t.notes), SuCard(child: Text(x.notes!, style: tt.bodyLarge?.copyWith(color: SuColors.ink)))],
        ]);
      }),
      ],
    );
  }
}

// ── Véhicules ────────────────────────────────────────────────────────────────
class _VehiculesTab extends ConsumerStatefulWidget {
  const _VehiculesTab({required this.ctx});
  final AppContext ctx;
  @override
  ConsumerState<_VehiculesTab> createState() => _VehiculesTabState();
}

class _VehiculesTabState extends ConsumerState<_VehiculesTab> {
  final _plaque = TextEditingController();
  RechercheVehicule? _resultat;
  bool _recherche = false, _horsLigne = false;

  /// Recherche : API (auditée) ; sans réseau, le cache local des plaques actives (rafraîchi à chaque
  /// ouverture en ligne) répond — jamais un résident (permission côté API + onglet non proposé).
  Future<void> _chercher() async {
    final brut = _plaque.text.trim();
    if (brut.length < 2) return;
    setState(() { _recherche = true; _resultat = null; _horsLigne = false; });
    final r = await ref.read(apiClientProvider).get<RechercheVehicule>('/vehicules/recherche', query: {'immatriculation': brut}, parse: (j) => RechercheVehicule.fromJson(asMap(j)));
    if (!mounted) return;
    if (r is ApiOk<RechercheVehicule>) {
      setState(() { _resultat = r.data; _recherche = false; });
      return;
    }
    // Hors-ligne (ou API indisponible) : cache local.
    final cache = await ref.read(localDatabaseProvider).getCache(_cachePlaques);
    if (!mounted) return;
    if (cache == null) {
      setState(() => _recherche = false);
      showToast(context, (r as ApiFail).error.message, error: true);
      return;
    }
    final cle = _normaliser(brut).replaceAll('-', '');
    final plaques = (jsonDecode(cache.json) as List).map((e) => PlaqueActive.fromJson((e as Map).cast<String, dynamic>())).toList();
    final trouvees = plaques.where((p) => p.immatriculation.replaceAll('-', '').contains(cle)).toList();
    Vehicule v(PlaqueActive p) => Vehicule(id: p.immatriculation, lotId: '', immatriculation: p.immatriculation, type: p.type, creeLe: '', lotNumero: p.lot, marque: p.marque, couleur: p.couleur, actif: true);
    final exact = trouvees.where((p) => p.immatriculation.replaceAll('-', '') == cle).firstOrNull;
    setState(() {
      _resultat = RechercheVehicule(immatriculation: _normaliser(brut), exact: exact == null ? null : v(exact), similaires: [for (final p in trouvees) if (p != exact) v(p)]);
      _recherche = false;
      _horsLigne = true;
    });
  }

  static String _normaliser(String v) => v.toUpperCase().replaceAll(RegExp(r'[\s._/]+'), '-').replaceAll(RegExp(r'-+'), '-').replaceAll(RegExp(r'^-|-$'), '').replaceAll(RegExp(r'[^A-Z0-9-]'), '');

  Future<void> _rafraichirCache() async {
    final r = await ref.read(apiClientProvider).get<List<PlaqueActive>>('/vehicules/plaques-actives', parse: (j) => parseList(j, PlaqueActive.fromJson));
    if (r is ApiOk<List<PlaqueActive>>) await ref.read(localDatabaseProvider).putCache(_cachePlaques, jsonEncode([for (final p in r.data) p.toJson()]));
  }

  @override
  void initState() {
    super.initState();
    if (widget.ctx.isGardien || widget.ctx.isGestion) Future.microtask(_rafraichirCache);
  }

  Future<void> _declarer([Vehicule? existant]) async {
    final d = context.dict;
    final ok = await showFormSheet<bool>(context, title: existant == null ? d.parkings.declarerVehicule : d.parkings.modifierVehicule, builder: (_) => VehiculeForm(ctx: widget.ctx, existant: existant));
    if (ok == true) ref.invalidate(vehiculesProvider);
  }

  Future<void> _retirer(Vehicule v) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.parkings.retirerVehicule, body: d.parkings.retirerVehiculeCorps, confirmLabel: d.parkings.retirerVehicule, danger: true);
    if (!ok || !mounted) return;
    final r = await ref.read(apiClientProvider).delete<dynamic>('/vehicules/${v.id}');
    if (!mounted) return;
    if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
    showToast(context, d.parkings.vehiculeRetire);
    ref.invalidate(vehiculesProvider);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = d.parkings;
    final e = d.enumsParkings;
    final tt = Theme.of(context).textTheme;
    final ctx = widget.ctx;
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final liste = ref.watch(vehiculesProvider(''));
    final peutDeclarer = ctx.isResident || ctx.isGestion;
    Widget ligne(Vehicule v, {bool actions = false}) => ListRow(
          leading: IconCircle(v.type == 'MOTO' ? Icons.two_wheeler_rounded : v.type == 'UTILITAIRE' ? Icons.local_shipping_rounded : Icons.directions_car_rounded, tone: v.actif ? Tone.sage : Tone.neutral),
          title: v.immatriculation,
          subtitle: '${t.lot} ${v.lotNumero ?? '—'} · ${e.typeVehicule[v.type] ?? v.type}${v.description.isNotEmpty ? ' · ${v.description}' : ''}',
          trailing: actions && peutDeclarer && v.actif
              ? PopupMenuButton<String>(icon: const Icon(Icons.more_vert_rounded, color: SuColors.link), onSelected: (k) => k == 'edit' ? _declarer(v) : _retirer(v), itemBuilder: (_) => [PopupMenuItem(value: 'edit', child: Text(d.common.modify)), PopupMenuItem(value: 'del', child: Text(t.retirerVehicule))])
              : StatusBadge(v.actif ? t.actif : t.inactif, variant: v.actif ? BadgeVariant.ok : BadgeVariant.neutral, small: true),
        );
    return RefreshIndicator(
      onRefresh: () async { ref.invalidate(vehiculesProvider); if (ctx.isGardien || ctx.isGestion) await _rafraichirCache(); },
      color: SuColors.link,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 96), children: [
        if (ctx.isGardien || ctx.isGestion) ...[
          // Recherche de plaque : titre de section Wise + tuile greige (champ blanc, pill « Rechercher »).
          SectionHeader(t.rechercher, subtitle: t.rechercherAide),
          SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: SuField(label: t.immatriculation, controller: _plaque, hint: '12345-A-6', keyboardType: TextInputType.visiblePassword)),
              const SizedBox(width: 8),
              // Le thème fixe minimumSize = Size.fromHeight(…) (largeur infinie) : borné explicitement dans une Row.
              Padding(padding: const EdgeInsets.only(top: 22), child: FilledButton.icon(style: FilledButton.styleFrom(minimumSize: const Size(0, 48), padding: const EdgeInsets.symmetric(horizontal: 14)), onPressed: _recherche ? null : _chercher, icon: const Icon(Icons.search_rounded, size: 18), label: Text(t.rechercherAction))),
            ]),
            if (!online) Padding(padding: const EdgeInsets.only(top: 8), child: StatusBadge(context.mdict.offlineCached, variant: BadgeVariant.warn, small: true)),
            if (_resultat != null) ...[
              const SizedBox(height: 14),
              if (_horsLigne) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(context.mdict.offlineCached, style: tt.bodySmall?.copyWith(color: SuColors.warn, fontWeight: FontWeight.w600))),
              if (_resultat!.exact != null) ...[Text(t.resultatExact, style: tt.labelMedium?.copyWith(color: SuColors.soft)), CardList([ligne(_resultat!.exact!)])] else Row(children: [const Icon(Icons.search_off_rounded, size: 20, color: SuColors.danger), const SizedBox(width: 8), Expanded(child: Text(t.aucunResultat, style: tt.bodyMedium?.copyWith(color: SuColors.danger, fontWeight: FontWeight.w600)))]),
              if (_resultat!.similaires.isNotEmpty) ...[const SizedBox(height: 10), Text(t.resultatsSimilaires, style: tt.labelMedium?.copyWith(color: SuColors.soft)), CardList([for (final v in _resultat!.similaires) ligne(v)])],
            ],
          ])),
        ],
        SectionHeader(ctx.isResident ? t.mesVehicules : t.vehicules, actionLabel: peutDeclarer ? t.declarerVehicule : null, onAction: peutDeclarer ? () => _declarer() : null),
        AsyncView(liste, onRetry: () => ref.invalidate(vehiculesProvider), data: (rows) => rows.isEmpty
            ? EmptyState(title: t.aucunVehicule, hint: t.aucunVehiculeAide, icon: Icons.directions_car_rounded, illustration: 'empty-parkings', actionLabel: peutDeclarer ? t.declarerVehicule : null, onAction: peutDeclarer ? () => _declarer() : null)
            : CardList([for (final v in rows) ligne(v, actions: true)])),
      ]),
    );
  }
}

/// Formulaire véhicule (résident : ses lots ; syndic : tout lot) — plaque normalisée côté API.
class VehiculeForm extends ConsumerStatefulWidget {
  const VehiculeForm({super.key, required this.ctx, this.existant, this.lotId});
  final AppContext ctx;
  final Vehicule? existant;
  final String? lotId;
  @override
  ConsumerState<VehiculeForm> createState() => _VehiculeFormState();
}

class _VehiculeFormState extends ConsumerState<VehiculeForm> {
  late final _immat = TextEditingController(text: widget.existant?.immatriculation ?? '');
  late final _marque = TextEditingController(text: widget.existant?.marque ?? '');
  late final _couleur = TextEditingController(text: widget.existant?.couleur ?? '');
  late String _type = widget.existant?.type ?? 'VOITURE';
  String? _lot;
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    _lot = widget.lotId ?? widget.existant?.lotId;
  }

  Future<void> _envoyer() async {
    final d = context.dict;
    setState(() { _loading = true; _fail = null; });
    final api = ref.read(apiClientProvider);
    final corps = {'immatriculation': _immat.text.trim(), 'marque': _marque.text.trim().isEmpty ? null : _marque.text.trim(), 'couleur': _couleur.text.trim().isEmpty ? null : _couleur.text.trim(), 'type': _type};
    final r = widget.existant == null
        ? await api.post<Vehicule>('/vehicules', body: {'lot_id': _lot, ...corps}, parse: (j) => Vehicule.fromJson(asMap(j)))
        : await api.patch<Vehicule>('/vehicules/${widget.existant!.id}', body: corps, parse: (j) => Vehicule.fromJson(asMap(j)));
    if (!mounted) return;
    if (r is ApiFail<Vehicule>) { setState(() { _loading = false; _fail = r; }); return; }
    if (widget.existant != null) {
      showToast(context, d.parkings.vehiculeModifie);
      Navigator.pop(context, true);
      return;
    }
    // Déclaration : succès plein écran (navigateur racine), après fermeture de la feuille.
    final racine = Navigator.of(context, rootNavigator: true).context;
    final plaque = (r as ApiOk<Vehicule>).data.immatriculation;
    Navigator.pop(context, true);
    if (racine.mounted) showSuccess(racine, title: scinderMessage(d.parkings.vehiculeDeclare).$1, body: plaque, illustration: 'ok-general');
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = d.parkings;
    final e = d.enumsParkings;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final mesLots = widget.ctx.isResident ? lots.where((x) => x.concerne(widget.ctx.profil.id)).toList() : lots;
    _lot ??= mesLots.firstOrNull?.id;
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (widget.existant == null && widget.lotId == null) ...[
        SuSelect<String?>(label: t.lot, value: _lot, options: mesLots.map((x) => x.id).toList(), labelOf: (v) => mesLots.where((x) => x.id == v).map((x) => x.numero).firstOrNull ?? '—', onChanged: (v) => setState(() => _lot = v), required: true, error: fieldError(_fail, 'lot_id')),
        const SizedBox(height: 12),
      ],
      SuField(label: t.immatriculation, controller: _immat, hint: '12345-A-6', help: t.immatriculationAide, error: fieldError(_fail, 'immatriculation'), keyboardType: TextInputType.visiblePassword),
      const SizedBox(height: 12),
      SuSelect<String>(label: t.typeVehicule, value: _type, options: const ['VOITURE', 'MOTO', 'UTILITAIRE'], labelOf: (v) => e.typeVehicule[v] ?? v, onChanged: (v) => setState(() => _type = v)),
      const SizedBox(height: 12),
      SuField(label: t.marque, controller: _marque, optionalLabel: d.common.optional),
      const SizedBox(height: 12),
      SuField(label: t.couleur, controller: _couleur, optionalLabel: d.common.optional),
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: widget.existant == null ? t.declarerVehicule : d.common.save, loading: _loading, onPressed: _immat.text.trim().length >= 2 || _loading ? _envoyer : null),
    ]);
  }
}

// ── Badges ───────────────────────────────────────────────────────────────────
class _BadgesTab extends ConsumerWidget {
  const _BadgesTab({required this.ctx});
  final AppContext ctx;

  Future<void> _perdu(BuildContext context, WidgetRef ref, BadgeAcces b) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.parkings.declarerPerdu, body: d.parkings.declarerPerduCorps, confirmLabel: d.parkings.declarerPerdu, danger: true, irreversible: true);
    if (!ok || !context.mounted) return;
    final r = await ref.read(apiClientProvider).post<dynamic>('/badges/${b.id}/perdu', body: {'creer_tache': true});
    if (!context.mounted) return;
    if (r is ApiFail) { showToast(context, r.error.message, error: true); return; }
    showToast(context, d.parkings.badgePerdu);
    ref.invalidate(badgesProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = d.parkings;
    final e = d.enumsParkings;
    final l = context.locale;
    final liste = ref.watch(badgesProvider(''));
    final peutSignaler = ctx.isResident || ctx.isGestion;
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(badgesProvider),
      color: SuColors.link,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 32), children: [
        SectionHeader(ctx.isResident ? t.mesBadges : t.badges),
        AsyncView(liste, onRetry: () => ref.invalidate(badgesProvider), data: (rows) => rows.isEmpty
            ? EmptyState(title: t.aucunBadge, hint: ctx.isGestion ? t.aucunBadgeAide : null, icon: Icons.badge_rounded, illustration: 'empty-parkings')
            : CardList([
                for (final b in rows)
                  ListRow(
                    leading: IconCircle(switch (b.type) { 'TELECOMMANDE_PARKING' => Icons.settings_remote_rounded, 'CLE_CAVE' => Icons.key_rounded, 'CARTE_ASCENSEUR' => Icons.elevator_rounded, _ => Icons.badge_rounded }, tone: b.statut == 'ACTIF' ? Tone.sage : b.statut == 'PERDU' ? Tone.danger : Tone.neutral),
                    title: '${b.identifiant} · ${e.typeBadge[b.type] ?? b.type}',
                    subtitle: '${t.lot} ${b.lotNumero ?? '—'} · ${t.remisLe} ${formatJourAnnee(b.remisLe, l)}${b.cautionMontant != null ? ' · ${t.caution} ${formatMAD(b.cautionMontant, l)}' : ''}${b.restitueLe != null ? ' · ${t.restitueLe} ${formatJourAnnee(b.restitueLe, l)}' : ''}',
                    trailing: b.statut == 'ACTIF' && peutSignaler
                        ? LinkButton(t.declarerPerdu, color: SuColors.danger, onTap: () => _perdu(context, ref, b))
                        : StatusBadge(e.statutBadge[b.statut] ?? b.statut, variant: badgeAccesVariant[b.statut] ?? BadgeVariant.neutral, small: true),
                  ),
              ])),
      ]),
    );
  }
}

// ── Places visiteurs du jour (gardien / gestion / conseil) ───────────────────
class _VisiteursTab extends ConsumerWidget {
  const _VisiteursTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = d.parkings;
    final l = context.locale;
    final tt = Theme.of(context).textTheme;
    final jour = ref.watch(visiteursAujourdhuiProvider);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(visiteursAujourdhuiProvider),
      color: SuColors.link,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
        Text(t.visiteursJourAide, style: tt.bodyLarge?.copyWith(color: SuColors.soft)),
        AsyncView(jour, onRetry: () => ref.invalidate(visiteursAujourdhuiProvider), data: (j) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionHeader(t.placesLibres),
          j.placesLibres.isEmpty
              ? Text(t.aucunePlace, style: tt.bodyMedium?.copyWith(color: SuColors.soft))
              : Wrap(spacing: 8, runSpacing: 8, children: [
                  // Places libres : pastilles « plaque » vert ok, code en chiffres mono.
                  for (final p in j.placesLibres)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                      decoration: BoxDecoration(color: SuColors.okTint, borderRadius: BorderRadius.circular(SuRadius.pill)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.local_parking_rounded, size: 16, color: SuColors.ok),
                        const SizedBox(width: 6),
                        Text('${p['code']}', textDirection: TextDirection.ltr, style: tt.labelLarge?.copyWith(color: SuColors.ok, fontFamily: 'GeistMono', fontWeight: FontWeight.w700)),
                      ]),
                    ),
                ]),
          SectionHeader(t.visiteursJour, actionLabel: d.nav.visites, onAction: () => context.push('/visites')),
          if (j.visites.isEmpty && j.sejours.isEmpty)
            EmptyState(title: t.aucunVisiteur, icon: Icons.local_parking_rounded, illustration: 'empty-visites')
          else
            CardList([
              for (final v in j.visites)
                ListRow(
                  leading: IconCircle(v['depassee'] == true ? Icons.timer_off_rounded : Icons.local_parking_rounded, tone: v['depassee'] == true ? Tone.danger : Tone.sand),
                  title: '${(v['emplacement'] as Map?)?['code'] ?? '—'} · ${v['visiteur_nom']}',
                  subtitle: '${t.lot} ${v['lot'] ?? '—'} · ${v['immatriculation'] ?? '—'} · ${formatHeure('${v['horodatage']}', l)}${v['heure_limite'] != null ? ' · ${t.heureLimite} ${formatHeure('${v['heure_limite']}', l)}' : ''}',
                  trailing: v['depassee'] == true ? StatusBadge(t.depassee, variant: BadgeVariant.danger, small: true, pulse: true) : null,
                ),
              for (final s in j.sejours)
                ListRow(
                  leading: const IconCircle(Icons.luggage_rounded, tone: Tone.lilac),
                  title: '${(s['emplacement'] as Map?)?['code'] ?? '—'} · ${s['voyageur']}',
                  subtitle: '${t.lot} ${s['lot'] ?? '—'} · ${s['immatriculation'] ?? '—'} · ${t.depart} ${formatJourAnnee('${s['date_depart']}', l)}',
                  trailing: StatusBadge(t.sejourLcd, variant: BadgeVariant.info, small: true),
                ),
            ]),
        ])),
      ]),
    );
  }
}

/// Feuille « place visiteur » d'une visite (gardien pour ses visites, syndic) — place PARKING_VISITEUR, plaque, heure limite.
class PlaceVisiteurSheet extends ConsumerStatefulWidget {
  const PlaceVisiteurSheet({super.key, required this.visite});
  final Visite visite;
  @override
  ConsumerState<PlaceVisiteurSheet> createState() => _PlaceVisiteurSheetState();
}

class _PlaceVisiteurSheetState extends ConsumerState<PlaceVisiteurSheet> {
  String? _place;
  late final _immat = TextEditingController(text: widget.visite.immatriculation ?? '');
  late DateTime? _limite = widget.visite.heureLimite != null ? DateTime.tryParse(widget.visite.heureLimite!)?.toLocal() : DateTime.now().add(const Duration(hours: 1));
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    _place = widget.visite.emplacementId;
  }

  Future<void> _choisirHeure() async {
    final h = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_limite ?? DateTime.now()));
    if (h == null) return;
    final now = DateTime.now();
    setState(() => _limite = DateTime(now.year, now.month, now.day, h.hour, h.minute));
  }

  Future<void> _envoyer() async {
    final d = context.dict;
    setState(() { _loading = true; _fail = null; });
    final r = await ref.read(apiClientProvider).post<dynamic>('/visites/${widget.visite.id}/emplacement', body: {'emplacement_id': _place, 'immatriculation': _immat.text.trim().isEmpty ? null : _immat.text.trim(), 'heure_limite': _place == null ? null : _limite?.toUtc().toIso8601String()});
    if (!mounted) return;
    if (r is ApiFail) { setState(() { _loading = false; _fail = r; }); return; }
    showToast(context, d.parkings.placeAttribuee);
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = d.parkings;
    final l = context.locale;
    final places = ref.watch(placesVisiteursProvider).valueOrNull ?? const <Emplacement>[];
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t.attribuerPlaceAide, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft)),
      const SizedBox(height: 12),
      SuSelect<String?>(label: t.placeVisiteur, value: _place, options: [null, ...places.map((p) => p.id)], labelOf: (v) => v == null ? t.retirerPlace : places.where((p) => p.id == v).map((p) => '${p.code}${p.niveau != null ? ' · ${t.niveau} ${p.niveau}' : ''}${p.visiteurOccupee && p.id != widget.visite.emplacementId ? ' · ${t.visiteurOccupee}' : ''}').firstOrNull ?? v, onChanged: (v) => setState(() => _place = v), error: fieldError(_fail, 'emplacement_id')),
      const SizedBox(height: 12),
      SuField(label: t.immatriculation, controller: _immat, hint: '12345-A-6', optionalLabel: d.common.optional, error: fieldError(_fail, 'immatriculation'), keyboardType: TextInputType.visiblePassword),
      const SizedBox(height: 12),
      if (_place != null)
        OutlinedButton.icon(onPressed: _choisirHeure, icon: const Icon(Icons.schedule_rounded, size: 18), label: Text('${t.heureLimite} · ${_limite != null ? formatHeure(_limite!.toIso8601String(), l) : '—'}')),
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(label: t.attribuerPlace, loading: _loading, onPressed: _loading ? null : _envoyer),
    ]);
  }
}

/// « Véhicule sur ma place » — le gardien / syndic prévient le lot propriétaire de la plaque signalée.
Future<void> notifierVehiculeGenant(BuildContext context, WidgetRef ref, Incident i) async {
  final d = context.dict;
  final ok = await confirmDialog(context, title: d.incidents.notifierVehicule, body: '${i.immatriculationSignalee ?? ''}\n${d.incidents.notifierVehiculeAide}', confirmLabel: d.incidents.notifierVehicule);
  if (!ok || !context.mounted) return;
  final r = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/incidents/${i.id}/notifier-vehicule', body: const {}, parse: asMap);
  if (!context.mounted) return;
  if (r is ApiFail<Map<String, dynamic>>) { showToast(context, r.error.message, error: true); return; }
  final data = (r as ApiOk<Map<String, dynamic>>).data;
  showToast(context, fill(d.incidents.vehiculeNotifie, {'lot': data['lot'] ?? '—', 'n': data['notifies'] ?? 0}));
  ref.invalidate(incidentProvider(i.id));
}
