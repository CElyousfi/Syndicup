import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/config/app_config.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../../offline/local_db/database.dart';
import '../../offline/sync_queue/lcd_sync.dart';
import '../../offline/sync_queue/visites_sync.dart';
import '../shell/app_shell.dart';
import '../visites/visites_screens.dart' show StatutReseauTile;
import 'lcd_sejour_screens.dart';

/// M15 Location courte durée (Doc A §10.2) — accueil par rôle, règlement (syndic), fiche de
/// déclaration (décision, gestionnaire, contacts, clôture).

// ── Accueil ───────────────────────────────────────────────────────────────────

class LcdScreen extends ConsumerStatefulWidget {
  const LcdScreen({super.key});
  @override
  ConsumerState<LcdScreen> createState() => _LcdScreenState();
}

class _LcdScreenState extends ConsumerState<LcdScreen> {
  LcdDuJour? _duJourCache;

  @override
  void initState() {
    super.initState();
    // Tableau du jour en cache : le gardien consulte les arrivées sans réseau.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final c = await ref.read(lcdSyncProvider.notifier).cachedDuJour();
      if (mounted && c != null) setState(() => _duJourCache = c);
    });
  }

  Future<void> _declarerLot() async {
    await showFormSheet<void>(context, title: ref.read(appContextProvider).isGestion ? context.dict.lcd.declarerLotTitre : context.dict.lcd.declarerLot, builder: (_) => const _DeclarationForm());
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final racine = !context.canPop();
    final me = ctx.profil.id;
    final terrain = ctx.isGardien || ctx.isGestion || ctx.isConseil;
    final peutConfirmer = ctx.isGardien || ctx.isGestion;
    final proprietaire = ctx.isProprietaire && !ctx.isGestion && !ctx.isConseil;
    final gestionnaire = ctx.isGestionnaireLcd && !ctx.isGestion && !proprietaire;

    final reglement = ref.watch(lcdReglementProvider);
    final declarations = ref.watch(lcdDeclarationsProvider);
    final sejours = ref.watch(lcdSejoursProvider);
    final duJour = terrain ? ref.watch(lcdDuJourProvider) : null;
    final queue = ref.watch(lcdQueueProvider).valueOrNull ?? const <LcdActionsQueueData>[];
    final sync = ref.watch(lcdSyncProvider);
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];

    if (duJour?.valueOrNull != null) ref.read(lcdSyncProvider.notifier).cacheDuJour(duJour!.valueOrNull!);
    final reg = reglement.valueOrNull;
    final decls = declarations.valueOrNull ?? const <LcdDeclaration>[];
    final validees = decls.where((x) => x.statut == 'VALIDEE').toList();
    final declarables = ctx.isGestion
        ? lots.where((x) => !decls.any((dd) => dd.lotId == x.id && dd.ouverte)).toList()
        : lots.where((x) => x.estProprietaire(me) && !decls.any((dd) => dd.lotId == x.id && dd.ouverte)).toList();
    final peutDeclarerLot = (proprietaire || ctx.isGestion) && (reg?.autorise ?? false) && declarables.isNotEmpty;
    final peutDeclarerSejour = ctx.declareSejoursLcd && validees.isNotEmpty;
    final enFile = queue.where((q) => !q.definitif).map((q) => q.sejourId).toSet();

    Widget regimeCard() {
      final r = reg;
      if (r == null) return const SizedBox.shrink();
      final p = r.parametres;
      final resume = r.regimeLcd == 'ENCADREE' && p != null
          ? [
              '${d.lcd.nuitsMax} : ${p.nbNuitsMaxParAn ?? d.lcd.sansQuota}',
              '${d.lcd.voyageursMax} : ${p.nbVoyageursMaxParLot ?? d.lcd.sansQuota}',
              '${d.lcd.delaiDeclaration} : ${p.delaiDeclarationHeures ?? d.lcd.sansQuota}',
            ].join(' · ')
          : switch (r.regimeLcd) { 'AUTORISEE' => d.lcd.regimeAutorisee, 'INTERDITE' => d.lcd.regimeInterditCorps, 'ENCADREE' => d.lcd.regimeEncadree, _ => d.lcd.regimeAide };
      return SuCard(
        onTap: ctx.isSyndic ? () => context.push('/location-courte-duree/reglement') : null,
        child: Row(
          children: [
            IconCircle(Icons.gavel_rounded, tone: switch (r.regimeLcd) { 'INTERDITE' => Tone.danger, 'NON_DEFINI' => Tone.neutral, 'ENCADREE' => Tone.tosca, _ => Tone.ok }),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [Expanded(child: Text(d.lcd.regime, style: t.titleMedium)), const SizedBox(width: 8), StatusBadge(d.enums.regimeLcd[r.regimeLcd] ?? r.regimeLcd, variant: regimeLcdVariant[r.regimeLcd] ?? BadgeVariant.neutral, small: true)]),
                  const SizedBox(height: 4),
                  Text(resume, style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.soft, height: 1.35), maxLines: 3, overflow: TextOverflow.ellipsis),
                  if (ctx.isSyndic) Padding(padding: const EdgeInsets.only(top: 8), child: Text(d.lcd.configurerReglement, style: t.labelMedium?.copyWith(color: SuColors.link, decoration: TextDecoration.underline, decorationColor: SuColors.link))),
                ],
              ),
            ),
          ],
        ),
      );
    }

    Widget bannieres() {
      final r = reg;
      if (r == null) return const SizedBox.shrink();
      if (r.regimeLcd == 'NON_DEFINI') {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SuBanner(
            tone: BannerTone.info,
            body: ctx.isSyndic ? d.lcd.regimeNonDefiniSyndic : d.lcd.regimeNonDefiniCorps,
            action: ctx.isSyndic ? SuButton(label: d.lcd.configurerReglement, variant: SuButtonVariant.ghost, onPressed: () => context.push('/location-courte-duree/reglement'), style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36))) : null,
          ),
        );
      }
      if (r.regimeLcd == 'INTERDITE') return Padding(padding: const EdgeInsets.only(bottom: 12), child: SuBanner(tone: BannerTone.danger, body: d.lcd.regimeInterditCorps));
      return const SizedBox.shrink();
    }

    Widget declarationRow(LcdDeclaration x) => ListRow(
          leading: IconCircle(Icons.apartment_rounded, tone: x.statut == 'EN_ATTENTE' ? Tone.warn : x.statut == 'VALIDEE' ? Tone.ok : Tone.neutral),
          title: '${d.lcd.lot} ${x.lotNumero}',
          subtitle: '${x.plateformes?.isNotEmpty == true ? '${x.plateformes!.join(', ')} · ' : ''}${md.lcdDeclareLe} ${formatDateCourte(x.creeLe, l)}',
          trailing: StatusBadge(d.enums.statutDeclarationLcd[x.statut] ?? x.statut, variant: declarationLcdVariant[x.statut] ?? BadgeVariant.neutral, small: true, pulse: x.statut == 'EN_ATTENTE' && ctx.isGestion),
          onTap: () => context.push('/location-courte-duree/declarations/${x.id}'),
        );

    Widget sejourTerrain(LcdSejour s, String action) => Column(
          children: [
            SejourRow(s, enAttente: enFile.contains(s.id), trailing: !peutConfirmer || enFile.contains(s.id) ? null : const SizedBox.shrink()),
            // Gardien : grande pill pleine largeur — arrivée = action principale, départ = contour.
            if (peutConfirmer && !enFile.contains(s.id))
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: action == 'arrivee'
                    ? SuButton(label: d.lcd.confirmerArrivee, icon: Icons.login_rounded, onPressed: () => confirmerSejour(context, ref, s, action))
                    : SuButton(label: d.lcd.confirmerDepart, icon: Icons.logout_rounded, variant: SuButtonVariant.secondary, onPressed: () => confirmerSejour(context, ref, s, action)),
              ),
          ],
        );

    // Libellé de groupe (Wise « Today », « Yesterday ») : petit, ardoise, au-dessus d'une liste.
    Widget groupe(String texte) => Padding(padding: const EdgeInsets.only(top: 4, bottom: 2), child: Text(texte, style: t.bodyMedium?.copyWith(color: SuColors.soft, fontWeight: FontWeight.w600)));

    Widget tableauDuJour() {
      final live = duJour!;
      final dj = live.valueOrNull ?? (live.hasError ? _duJourCache : null);
      final horsLigne = live.hasError && _duJourCache != null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(md.today, subtitle: dj == null ? null : formatJourAnnee(dj.date, l)),
          if (horsLigne) Padding(padding: const EdgeInsets.only(bottom: 10), child: SuBanner(tone: BannerTone.warn, body: md.offlineCached)),
          if (dj == null)
            AsyncView(live, onRetry: () => ref.invalidate(lcdDuJourProvider), skeletonCount: 2, data: (_) => const SizedBox.shrink())
          else if (dj.vide)
            ctx.isGardien
                ? EmptyState(title: d.lcd.rienAujourdhui, icon: Icons.luggage_rounded, illustration: 'empty-lcd')
                : Text(d.lcd.rienAujourdhui, style: t.bodyMedium?.copyWith(color: SuColors.soft))
          else ...[
            if (dj.arrivees.isNotEmpty) ...[
              groupe('${d.lcd.arrivees} · ${dj.arrivees.length}'),
              CardList([for (final s in dj.arrivees) KeyedSubtree(key: ValueKey(s.id), child: sejourTerrain(s, 'arrivee'))]),
              const SizedBox(height: 12),
            ],
            if (dj.departs.isNotEmpty) ...[
              groupe('${d.lcd.departs} · ${dj.departs.length}'),
              CardList([for (final s in dj.departs) KeyedSubtree(key: ValueKey(s.id), child: sejourTerrain(s, 'depart'))]),
              const SizedBox(height: 12),
            ],
            if (dj.enCours.where((s) => !dj.departs.any((x) => x.id == s.id)).isNotEmpty) ...[
              groupe('${d.lcd.enCours} · ${dj.enCours.length}'),
              CardList([for (final s in dj.enCours.where((s) => !dj.departs.any((x) => x.id == s.id))) SejourRow(s, key: ValueKey(s.id), enAttente: enFile.contains(s.id))]),
            ],
          ],
        ],
      );
    }

    final titre = d.lcd.titre;
    final fab = peutDeclarerSejour ? FloatingActionButton.extended(onPressed: () => context.push('/location-courte-duree/sejours/nouveau'), icon: const Icon(Icons.luggage_rounded), label: Text(d.lcd.declarerSejour)) : null;
    Future<void> refresh() async {
      ref.invalidate(lcdReglementProvider);
      ref.invalidate(lcdDeclarationsProvider);
      ref.invalidate(lcdSejoursProvider);
      if (terrain) ref.invalidate(lcdDuJourProvider);
      await ref.read(lcdSyncProvider.notifier).flush();
    }

    final contenu = <Widget>[
      // Réseau : état lisible d'un coup d'œil pour qui confirme arrivées et départs.
      if (peutConfirmer) ...[StatutReseauTile(online: online, syncing: sync.syncing, hint: md.lcdOfflineConfirm), const SizedBox(height: 12)],
      if (queue.isNotEmpty) ...[LcdQueueCard(queue: queue), const SizedBox(height: 12)],
      if (reglement.hasError && reg == null && !ctx.isGardien) ErrorState(error: reglement.error!, onRetry: () => ref.invalidate(lcdReglementProvider)),
      bannieres(),
      if (ctx.isGestion || ctx.isConseil) ...[
        regimeCard(),
        const SizedBox(height: 12),
        TwoCols([
          StatTile(label: md.pending, value: '${decls.where((x) => x.statut == 'EN_ATTENTE').length}', tone: Tone.warn, icon: Icons.pending_actions_rounded),
          StatTile(label: d.lcd.enCours, value: '${(sejours.valueOrNull ?? const <LcdSejour>[]).where((s) => s.statut == 'EN_COURS').length}', tone: Tone.ok, icon: Icons.luggage_rounded),
        ]),
        if (ctx.isConseil) Padding(padding: const EdgeInsets.only(top: 10), child: SuBanner(tone: BannerTone.legal, body: md.lcdConseilLecture)),
        SectionHeader(d.lcd.declarations, actionLabel: peutDeclarerLot ? d.common.add : null, onAction: peutDeclarerLot ? _declarerLot : null),
        AsyncView(declarations, onRetry: () => ref.invalidate(lcdDeclarationsProvider), skeletonCount: 2, data: (list) {
          if (list.isEmpty) return EmptyState(title: d.lcd.aucuneDeclaration, hint: d.lcd.aucuneDeclarationAide, icon: Icons.luggage_rounded, illustration: 'empty-lcd');
          const ordre = ['EN_ATTENTE', 'VALIDEE', 'SUSPENDUE', 'REFUSEE', 'CLOTUREE'];
          final sorted = [...list]..sort((a, b) {
              final c = ordre.indexOf(a.statut).compareTo(ordre.indexOf(b.statut));
              return c != 0 ? c : b.creeLe.compareTo(a.creeLe);
            });
          return CardList([for (final x in sorted.take(50)) KeyedSubtree(key: ValueKey(x.id), child: declarationRow(x))]);
        }),
        tableauDuJour(),
      ] else if (ctx.isGardien) ...[
        tableauDuJour(),
        AsyncView(sejours, onRetry: () => ref.invalidate(lcdSejoursProvider), skeletonCount: 1, data: (list) {
          final aujourdhui = jourIso(DateTime.now());
          final aVenir = list.where((s) => s.statut == 'PREVU' && s.jourArrivee.compareTo(aujourdhui) > 0).toList()..sort((a, b) => a.jourArrivee.compareTo(b.jourArrivee));
          if (aVenir.isEmpty) return const SizedBox.shrink();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [SectionHeader(d.lcd.aVenir), CardList([for (final s in aVenir.take(20)) SejourRow(s, key: ValueKey(s.id))])]);
        }),
      ] else ...[
        // Propriétaire / gestionnaire : mes déclarations, mes séjours.
        if (reg != null && reg.autorise && reg.regimeLcd == 'ENCADREE') Padding(padding: const EdgeInsets.only(bottom: 12), child: SuBanner(tone: BannerTone.info, body: d.lcd.regimeEncadree)),
        SectionHeader(d.lcd.mesLocations, actionLabel: peutDeclarerLot ? d.lcd.declarerLot : null, onAction: peutDeclarerLot ? _declarerLot : null),
        AsyncView(declarations, onRetry: () => ref.invalidate(lcdDeclarationsProvider), skeletonCount: 2, data: (list) {
          if (list.isEmpty) {
            return EmptyState(
              title: d.lcd.aucuneDeclaration,
              hint: gestionnaire ? d.lcd.aucuneDeclarationAide : (reg?.autorise ?? false) ? d.lcd.declarerLotAide : null,
              icon: Icons.luggage_rounded,
              illustration: 'empty-lcd',
              actionLabel: peutDeclarerLot ? d.lcd.declarerLot : null,
              onAction: peutDeclarerLot ? _declarerLot : null,
            );
          }
          final sorted = [...list]..sort((a, b) => b.creeLe.compareTo(a.creeLe));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CardList([for (final x in sorted) KeyedSubtree(key: ValueKey(x.id), child: declarationRow(x))]),
              if (sorted.any((x) => x.statut == 'EN_ATTENTE')) Padding(padding: const EdgeInsets.only(top: 10), child: SuBanner(tone: BannerTone.info, body: d.lcd.declareeEnAttente)),
            ],
          );
        }),
        SectionHeader(d.lcd.mesSejours, actionLabel: peutDeclarerSejour ? d.lcd.declarerSejour : null, onAction: peutDeclarerSejour ? () => context.push('/location-courte-duree/sejours/nouveau') : null),
        AsyncView(sejours, onRetry: () => ref.invalidate(lcdSejoursProvider), skeletonCount: 2, data: (list) {
          if (list.isEmpty) return EmptyState(title: d.lcd.aucunSejour, hint: peutDeclarerSejour ? d.lcd.aucunSejourAide : null, icon: Icons.luggage_rounded, illustration: 'empty-lcd', actionLabel: peutDeclarerSejour ? d.lcd.declarerSejour : null, onAction: peutDeclarerSejour ? () => context.push('/location-courte-duree/sejours/nouveau') : null);
          final actifs = list.where((s) => s.actif).toList()..sort((a, b) => a.jourArrivee.compareTo(b.jourArrivee));
          final passes = trierSejours(list.where((s) => !s.actif).toList());
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (actifs.isNotEmpty) CardList([for (final s in actifs) SejourRow(s, key: ValueKey(s.id))]),
              if (passes.isNotEmpty) ...[
                const SizedBox(height: 14),
                groupe(d.lcd.historique),
                CardList([for (final s in passes.take(20)) SejourRow(s, key: ValueKey(s.id))]),
              ],
            ],
          );
        }),
      ],
    ];

    // Écran racine (onglet) : en-tête de la coque ; poussé : page Wise (retour rond, grand titre).
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

/// Feuille « Déclarer mon lot » (propriétaire) / « Déclarer un lot » (syndic, au nom du
/// propriétaire) — POST /lcd/declarations. Le gestionnaire se désigne ensuite depuis la fiche.
class _DeclarationForm extends ConsumerStatefulWidget {
  const _DeclarationForm();
  @override
  ConsumerState<_DeclarationForm> createState() => _DeclarationFormState();
}

class _DeclarationFormState extends ConsumerState<_DeclarationForm> {
  String? _lot;
  final _plateformes = TextEditingController();
  final _nom = TextEditingController();
  final _tel = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final decls = ref.watch(lcdDeclarationsProvider).valueOrNull ?? const <LcdDeclaration>[];
    final options = (ctx.isGestion ? lots : lots.where((x) => x.estProprietaire(ctx.profil.id))).where((x) => !decls.any((dd) => dd.lotId == x.id && dd.ouverte)).toList();
    if (_lot == null && options.length == 1) _lot = options.first.id;
    final reg = ref.watch(lcdReglementProvider).valueOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.lcd.declarerLotAide, style: t.bodyMedium?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 18),
        if (options.isEmpty)
          SuBanner(tone: BannerTone.warn, body: md.lcdAucunLotDeclarable)
        else
          SuSelect<String>(label: d.lcd.lot, value: _lot, options: options.map((x) => x.id).toList(), labelOf: (id) => options.firstWhere((x) => x.id == id).numero, onChanged: (v) => setState(() => _lot = v), required: true, placeholder: md.selectLot, error: fieldError(_fail, 'lot_id')),
        const SizedBox(height: 16),
        SuField(label: d.lcd.plateformes, controller: _plateformes, hint: d.lcd.plateformesAide, optionalLabel: d.common.optional, error: fieldError(_fail, 'plateformes')),
        const SizedBox(height: 16),
        SuField(label: d.lcd.contactUrgenceNom, controller: _nom, required: reg?.parametres?.contactGardienObligatoire ?? false, optionalLabel: d.common.optional, error: fieldError(_fail, 'contact_urgence_nom')),
        const SizedBox(height: 16),
        SuField(label: d.lcd.contactUrgenceTelephone, controller: _tel, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, required: reg?.parametres?.contactGardienObligatoire ?? false, optionalLabel: d.common.optional, error: fieldError(_fail, 'contact_urgence_telephone')),
        const SizedBox(height: 20),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.send,
          loading: _loading,
          onPressed: _lot == null
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final plateformes = _plateformes.text.split(RegExp(r'[,;\n]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
                  final r = await ref.read(apiClientProvider).post<LcdDeclaration>('/lcd/declarations', body: {
                    'lot_id': _lot,
                    if (plateformes.isNotEmpty) 'plateformes': plateformes,
                    'contact_urgence_nom': _nom.text.trim().isEmpty ? null : _nom.text.trim(),
                    'contact_urgence_telephone': _tel.text.trim().isEmpty ? null : normaliserTelephone(_tel.text) ?? _tel.text.trim(),
                  }, parse: (j) => LcdDeclaration.fromJson(asMap(j)));
                  if (!context.mounted) return;
                  switch (r) {
                    case ApiOk<LcdDeclaration>(:final data):
                      ref.invalidate(lcdDeclarationsProvider);
                      ref.invalidate(lcdSyntheseProvider(data.lotId));
                      // Feuille fermée : succès sur le navigateur racine, puis la fiche de la déclaration.
                      final racine = Navigator.of(context, rootNavigator: true).context;
                      final router = GoRouter.of(context);
                      Navigator.pop(context);
                      await showSuccess(racine, title: scinderSucces(d.lcd.declaree).title, body: data.statut == 'EN_ATTENTE' ? scinderSucces(d.lcd.declareeEnAttente).body : null, illustration: 'ok-general');
                      router.push('/location-courte-duree/declarations/${data.id}');
                    case ApiFail<LcdDeclaration>():
                      setState(() {
                        _loading = false;
                        _fail = r;
                      });
                  }
                },
          fail: _fail,
        ),
      ],
    );
  }
}

// ── Règlement (syndic) ────────────────────────────────────────────────────────

class LcdReglementScreen extends ConsumerStatefulWidget {
  const LcdReglementScreen({super.key});
  @override
  ConsumerState<LcdReglementScreen> createState() => _LcdReglementScreenState();
}

class _LcdReglementScreenState extends ConsumerState<LcdReglementScreen> {
  String _regime = 'NON_DEFINI';
  bool _prealable = true, _gestionnaireObligatoire = false, _contactGardien = true;
  final _delai = TextEditingController();
  final _nuits = TextEditingController();
  final _voyageurs = TextEditingController();
  final _resolution = TextEditingController();
  bool _prefilled = false, _loading = false;
  ApiFail? _fail;

  void _prefill(LcdReglement r) {
    _regime = r.regimeLcd;
    _resolution.text = r.regimeLcdAgResolutionId ?? '';
    final p = r.parametres;
    if (p != null) {
      _prealable = p.declarationPrealableObligatoire;
      _gestionnaireObligatoire = p.gestionnaireObligatoireSiProprietaireAbsent;
      _contactGardien = p.contactGardienObligatoire;
      _delai.text = p.delaiDeclarationHeures?.toString() ?? '';
      _nuits.text = p.nbNuitsMaxParAn?.toString() ?? '';
      _voyageurs.text = p.nbVoyageursMaxParLot?.toString() ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final reglement = ref.watch(lcdReglementProvider);
    if (reglement.valueOrNull != null && !_prefilled) {
      _prefilled = true;
      _prefill(reglement.valueOrNull!);
    }
    return SuPage(
      title: d.lcd.reglementTitre,
      subtitle: d.lcd.reglementSubtitle,
      children: [
        if (reglement.isLoading && !_prefilled)
          const LoadingList(count: 3)
        else ...[
          SuSelect<String>(label: d.lcd.regime, value: _regime, options: d.enums.regimeLcd.keys.toList(), labelOf: (v) => d.enums.regimeLcd[v] ?? v, onChanged: (v) => setState(() => _regime = v), required: true, error: fieldError(_fail, 'regime_lcd'), help: d.lcd.regimeAide),
          const SizedBox(height: 14),
          // Effet du régime choisi, en clair.
          SuBanner(
            tone: switch (_regime) { 'INTERDITE' => BannerTone.danger, 'AUTORISEE' => BannerTone.ok, 'NON_DEFINI' => BannerTone.legal, _ => BannerTone.info },
            body: switch (_regime) { 'AUTORISEE' => d.lcd.regimeAutorisee, 'INTERDITE' => d.lcd.regimeInterditCorps, 'ENCADREE' => d.lcd.regimeEncadree, _ => d.lcd.regimeNonDefiniSyndic },
          ),
          if (_regime == 'ENCADREE') ...[
            SectionHeader(d.lcd.parametres, subtitle: d.lcd.parametresAide),
            SuCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SuCheckbox(value: _prealable, onChanged: (v) => setState(() => _prealable = v), label: d.lcd.declarationPrealable),
                  SuCheckbox(value: _gestionnaireObligatoire, onChanged: (v) => setState(() => _gestionnaireObligatoire = v), label: d.lcd.gestionnaireObligatoire),
                  SuCheckbox(value: _contactGardien, onChanged: (v) => setState(() => _contactGardien = v), label: d.lcd.contactGardien),
                  const SizedBox(height: 14),
                  SuField(label: d.lcd.delaiDeclaration, controller: _delai, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], hint: d.lcd.sansQuota, help: d.lcd.delaiDeclarationAide, optionalLabel: d.common.optional, error: fieldError(_fail, 'parametres_lcd_json.delai_declaration_heures')),
                  const SizedBox(height: 16),
                  SuField(label: d.lcd.nuitsMax, controller: _nuits, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], hint: d.lcd.sansQuota, optionalLabel: d.common.optional, error: fieldError(_fail, 'parametres_lcd_json.nb_nuits_max_par_an')),
                  const SizedBox(height: 16),
                  SuField(label: d.lcd.voyageursMax, controller: _voyageurs, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], hint: d.lcd.sansQuota, optionalLabel: d.common.optional, error: fieldError(_fail, 'parametres_lcd_json.nb_voyageurs_max_par_lot')),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),
          SuField(label: d.lcd.agResolution, controller: _resolution, help: d.lcd.agResolutionAide, mono: true, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, error: fieldError(_fail, 'ag_resolution_id')),
          const SizedBox(height: 28),
          FormError(_fail),
          if (_fail != null) const SizedBox(height: 12),
          SubmitButton(label: d.common.save, loading: _loading, onPressed: _submit, fail: _fail),
        ],
      ],
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    int? n(TextEditingController c) => c.text.trim().isEmpty ? null : int.tryParse(c.text.trim());
    final r = await ref.read(apiClientProvider).request<LcdReglement>('PUT', '/lcd/reglement', body: {
      'regime_lcd': _regime,
      'parametres_lcd_json': _regime == 'ENCADREE'
          ? LcdParametres(
              declarationPrealableObligatoire: _prealable,
              delaiDeclarationHeures: n(_delai),
              nbNuitsMaxParAn: n(_nuits),
              nbVoyageursMaxParLot: n(_voyageurs),
              gestionnaireObligatoireSiProprietaireAbsent: _gestionnaireObligatoire,
              contactGardienObligatoire: _contactGardien,
            ).toJson()
          : null,
      'ag_resolution_id': _resolution.text.trim().isEmpty ? null : _resolution.text.trim(),
    }, parse: (j) => LcdReglement.fromJson(asMap(j)));
    if (!mounted) return;
    switch (r) {
      case ApiOk<LcdReglement>():
        ref.invalidate(lcdReglementProvider);
        showToast(context, context.dict.lcd.reglementEnregistre);
        context.pop();
      case ApiFail<LcdReglement>():
        setState(() {
          _loading = false;
          _fail = r;
        });
    }
  }
}

// ── Fiche déclaration ─────────────────────────────────────────────────────────

class LcdDeclarationScreen extends ConsumerStatefulWidget {
  const LcdDeclarationScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<LcdDeclarationScreen> createState() => _LcdDeclarationScreenState();
}

class _LcdDeclarationScreenState extends ConsumerState<LcdDeclarationScreen> {
  bool _loading = false;

  void _refresh(LcdDeclaration x) {
    ref.invalidate(lcdDeclarationProvider(widget.id));
    ref.invalidate(lcdDeclarationsProvider);
    ref.invalidate(lcdSyntheseProvider(x.lotId));
  }

  Future<void> _decider(LcdDeclaration x) async {
    await showFormSheet<void>(context, title: context.dict.lcd.decision, builder: (_) => _DecisionForm(declaration: x, onDone: () => _refresh(x)));
  }

  Future<void> _gestionnaire(LcdDeclaration x) async {
    await showFormSheet<void>(context, title: context.dict.lcd.designerGestionnaire, builder: (_) => _GestionnaireForm(declaration: x, onDone: () => _refresh(x)));
  }

  Future<void> _contacts(LcdDeclaration x) async {
    await showFormSheet<void>(context, title: context.dict.lcd.modifierContacts, builder: (_) => _ContactsForm(declaration: x, onDone: () => _refresh(x)));
  }

  Future<void> _cloturer(LcdDeclaration x) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.lcd.cloturer, body: d.lcd.cloturerAide, confirmLabel: d.lcd.cloturer, danger: true, irreversible: true);
    if (!ok || !mounted) return;
    setState(() => _loading = true);
    final r = await ref.read(apiClientProvider).post<LcdDeclaration>('/lcd/declarations/${x.id}/cloturer', body: const {}, parse: (j) => LcdDeclaration.fromJson(asMap(j)));
    if (!mounted) return;
    setState(() => _loading = false);
    switch (r) {
      case ApiOk<LcdDeclaration>():
        _refresh(x);
        showToast(context, d.lcd.cloturee);
      case ApiFail<LcdDeclaration>(:final error):
        showToast(context, error.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final decl = ref.watch(lcdDeclarationProvider(widget.id));
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final me = ctx.profil.id;

    return SuPage(
      title: d.lcd.declarations,
      subtitle: decl.valueOrNull == null ? null : fill(md.lcdDeclarationDeLot, {'lot': decl.valueOrNull!.lotNumero}),
      onRefresh: () async => ref.invalidate(lcdDeclarationProvider(widget.id)),
      children: [
        AsyncView(decl, onRetry: () => ref.invalidate(lcdDeclarationProvider(widget.id)), data: (x) {
          final estProprio = x.declareParId == me || lots.any((lt) => lt.id == x.lotId && lt.estProprietaire(me));
          final peutGerer = ctx.isGestion || (ctx.isProprietaire && estProprio);
          final peutContacts = peutGerer || (ctx.isGestionnaireLcd && x.gestionnaireId == me);
          final sejours = trierSejours(x.sejours);
          final sejourActif = sejours.any((s) => s.actif);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Résumé Wise : grande pastille, lot en grand, date de déclaration, statut.
              SuEnter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconCircle(Icons.apartment_rounded, tone: x.statut == 'VALIDEE' ? Tone.ok : x.statut == 'EN_ATTENTE' ? Tone.warn : Tone.neutral, size: 64),
                    const SizedBox(height: 16),
                    Text('${d.enums.typeLot[x.lot?.typeLot] ?? d.lcd.lot} ${x.lotNumero}', style: t.displaySmall),
                    const SizedBox(height: 4),
                    Text('${md.lcdDeclareLe} ${formatDateCourte(x.creeLe, l)}', style: t.bodyLarge?.copyWith(color: SuColors.soft)),
                    const SizedBox(height: 12),
                    StatusBadge(d.enums.statutDeclarationLcd[x.statut] ?? x.statut, variant: declarationLcdVariant[x.statut] ?? BadgeVariant.neutral, pulse: x.statut == 'EN_ATTENTE'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    KeyValueRow(d.lcd.plateformes, x.plateformes?.isNotEmpty == true ? x.plateformes!.join(', ') : '—'),
                    KeyValueRow(d.lcd.contactUrgence, [x.contactUrgenceNom, formatTelephone(x.contactUrgenceTelephone)].where((s) => s != null && s.isNotEmpty && s != '—').join(' · ').replaceFirst(RegExp(r'^$'), '—')),
                    KeyValueRow(d.lcd.gestionnaire, '', valueWidget: Align(alignment: AlignmentDirectional.centerEnd, child: StatusBadge(x.gestionnaireId != null ? md.lcdGestionnaireDesigne : d.lcd.aucunGestionnaire, variant: x.gestionnaireId != null ? BadgeVariant.ok : BadgeVariant.neutral, small: true))),
                    if (x.dateFin != null) KeyValueRow(d.lcd.dateFin, formatDateCourte(x.dateFin, l)),
                    if (x.motifDecision != null && x.motifDecision!.isNotEmpty) KeyValueRow(d.lcd.motif, x.motifDecision!),
                    if (x.decideLe != null) KeyValueRow(d.lcd.decision, formatDateHeure(x.decideLe, l)),
                  ],
                ),
              ),
              if (x.statut == 'EN_ATTENTE' && !ctx.isGestion) ...[const SizedBox(height: 12), SuBanner(tone: BannerTone.info, body: d.lcd.declareeEnAttente)],
              const SizedBox(height: 20),
              if (ctx.isGestion && x.ouverte) ...[
                SubmitButton(label: md.lcdDecider, icon: Icons.gavel_rounded, loading: _loading, onPressed: () => _decider(x)),
                const SizedBox(height: 10),
              ],
              if (peutGerer && x.ouverte)
                Row(
                  children: [
                    Expanded(child: SubmitButton(label: d.lcd.designerGestionnaire, icon: Icons.person_add_alt_1_rounded, secondary: true, onPressed: () => _gestionnaire(x))),
                    const SizedBox(width: 10),
                    Expanded(child: SubmitButton(label: d.lcd.modifierContacts, icon: Icons.contact_phone_rounded, secondary: true, onPressed: () => _contacts(x))),
                  ],
                )
              else if (peutContacts && x.ouverte)
                SubmitButton(label: d.lcd.modifierContacts, icon: Icons.contact_phone_rounded, secondary: true, onPressed: () => _contacts(x)),
              if (peutGerer && x.ouverte) ...[
                const SizedBox(height: 10),
                // Destructif : contour rouge (confirmation « danger » + irréversible à l'appui).
                SuButton(label: d.lcd.cloturer, icon: Icons.lock_outline_rounded, variant: SuButtonVariant.secondary, onPressed: _loading || sejourActif ? null : () => _cloturer(x), style: OutlinedButton.styleFrom(foregroundColor: SuColors.danger, side: BorderSide(color: sejourActif ? SuColors.hairlineStrong : SuColors.danger, width: 1.2))),
                if (sejourActif) Padding(padding: const EdgeInsets.only(top: 8), child: Text(d.lcd.cloturerAide, style: t.bodySmall)),
              ],
              if (ctx.isGestion || ctx.isProprietaire) ...[
                const SizedBox(height: 8),
                Center(child: LinkButton(md.lcdVoirLot, onTap: () => context.push('/lots/${x.lotId}'))),
              ],
              SectionHeader(d.lcd.sejours, actionLabel: x.statut == 'VALIDEE' && ctx.declareSejoursLcd ? d.lcd.declarerSejour : null, onAction: () => context.push('/location-courte-duree/sejours/nouveau?lot=${x.lotId}')),
              sejours.isEmpty ? Text(d.lcd.aucunSejour, style: t.bodyMedium?.copyWith(color: SuColors.soft)) : CardList([for (final s in sejours.take(30)) SejourRow(s, key: ValueKey(s.id))]),
            ],
          );
        }),
      ],
    );
  }
}

/// Décision du syndic (VALIDEE / REFUSEE / SUSPENDUE) — écriture probante : Idempotency-Key.
class _DecisionForm extends ConsumerStatefulWidget {
  const _DecisionForm({required this.declaration, required this.onDone});
  final LcdDeclaration declaration;
  final VoidCallback onDone;
  @override
  ConsumerState<_DecisionForm> createState() => _DecisionFormState();
}

class _DecisionFormState extends ConsumerState<_DecisionForm> {
  final _key = const Uuid().v4();
  String _decision = 'VALIDEE';
  final _motif = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final md = context.mdict;
    final d = context.dict;
    final options = ['VALIDEE', 'REFUSEE', 'SUSPENDUE'].where((o) => o != widget.declaration.statut).toList();
    if (!options.contains(_decision)) _decision = options.first;
    final motifRequis = _decision != 'VALIDEE';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.lcd.decisionAide, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 16),
        Segmented<String>(value: _decision, options: options, labelOf: (v) => d.enums.statutDeclarationLcd[v] ?? v, onChanged: (v) => setState(() => _decision = v)),
        const SizedBox(height: 18),
        SuField(label: d.lcd.motif, controller: _motif, maxLines: 3, required: motifRequis, optionalLabel: motifRequis ? null : context.dict.common.optional, help: motifRequis ? d.lcd.motifAide : null, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'motif')),
        const SizedBox(height: 12),
        Text(md.retryHint, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 20),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: md.lcdDecider,
          loading: _loading,
          danger: _decision == 'REFUSEE',
          onPressed: motifRequis && _motif.text.trim().isEmpty
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final r = await ref.read(apiClientProvider).post<LcdDeclaration>('/lcd/declarations/${widget.declaration.id}/decision', body: {'decision': _decision, 'motif': _motif.text.trim().isEmpty ? null : _motif.text.trim()}, idempotencyKey: _key, parse: (j) => LcdDeclaration.fromJson(asMap(j)));
                  if (!context.mounted) return;
                  switch (r) {
                    case ApiOk<LcdDeclaration>():
                      widget.onDone();
                      Navigator.pop(context);
                      showToast(context, d.lcd.decisionEnregistree);
                    case ApiFail<LcdDeclaration>():
                      setState(() {
                        _loading = false;
                        _fail = r;
                      });
                  }
                },
          fail: _fail,
        ),
      ],
    );
  }
}

/// Désignation d'un gestionnaire : compte existant (identifiant) ou invitation (e-mail /
/// téléphone + canal) — le code d'invitation retourné est affiché et partageable.
class _GestionnaireForm extends ConsumerStatefulWidget {
  const _GestionnaireForm({required this.declaration, required this.onDone});
  final LcdDeclaration declaration;
  final VoidCallback onDone;
  @override
  ConsumerState<_GestionnaireForm> createState() => _GestionnaireFormState();
}

class _GestionnaireFormState extends ConsumerState<_GestionnaireForm> {
  String _mode = 'inviter';
  String _canal = 'SMS';
  final _userId = TextEditingController();
  final _email = TextEditingController();
  final _tel = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  Invitation? _invitation;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final t = Theme.of(context).textTheme;
    final inv = _invitation;
    if (inv != null) {
      final lien = '${AppConfig.webBaseUrl}/${context.locale.languageCode}/invitation/${inv.code}';
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SuBanner(tone: BannerTone.ok, body: d.lcd.gestionnaireInvite),
          const SizedBox(height: 14),
          // Code d'invitation : grand, sur tuile greige, toujours lu de gauche à droite.
          SuCard(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
            child: Column(
              children: [
                FittedBox(fit: BoxFit.scaleDown, child: Text(inv.code, style: t.displayMedium?.copyWith(fontFamily: 'GeistMono', letterSpacing: 4), textDirection: TextDirection.ltr)),
                const SizedBox(height: 6),
                Text('${d.enums.canal[inv.canal] ?? inv.canal} · ${formatDateCourte(inv.expireLe, context.locale)}', style: t.bodySmall, textAlign: TextAlign.center),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: SuButton(
                  label: d.common.copy,
                  icon: Icons.copy_rounded,
                  variant: SuButtonVariant.secondary,
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: inv.code));
                    showToast(context, md.copied);
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: SuButton(label: d.common.share, icon: Icons.share_rounded, onPressed: () => Share.share('${d.invitations.transmettre} : ${inv.code}\n$lien'))),
            ],
          ),
          const SizedBox(height: 10),
          SuButton(label: d.common.close, variant: SuButtonVariant.ghost, onPressed: () => Navigator.pop(context)),
        ],
      );
    }
    final inviter = _mode == 'inviter';
    final valide = inviter ? (_email.text.trim().isNotEmpty || _tel.text.trim().isNotEmpty) : _userId.text.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.lcd.gestionnaireAide, style: t.bodyMedium?.copyWith(color: SuColors.soft)),
        const SizedBox(height: 16),
        Segmented<String>(value: _mode, options: const ['inviter', 'compte'], labelOf: (v) => v == 'inviter' ? md.lcdInviter : d.lcd.gestionnaireCompte, onChanged: (v) => setState(() => _mode = v)),
        const SizedBox(height: 18),
        if (inviter) ...[
          SuField(label: d.lcd.gestionnaireTelephone, controller: _tel, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, hint: '+212 6…', onChanged: (_) => setState(() {}), error: fieldError(_fail, 'telephone')),
          const SizedBox(height: 16),
          SuField(label: d.lcd.gestionnaireEmail, controller: _email, keyboardType: TextInputType.emailAddress, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'email')),
          const SizedBox(height: 16),
          SuSelect<String>(label: d.lcd.canalInvitation, value: _canal, options: const ['SMS', 'WHATSAPP', 'EMAIL', 'QR_CODE'], labelOf: (v) => d.enums.canal[v] ?? v, onChanged: (v) => setState(() => _canal = v)),
        ] else
          SuField(label: d.lcd.gestionnaireId, controller: _userId, mono: true, textDirection: TextDirection.ltr, help: d.lcd.gestionnaireIdAide, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'utilisateur_id')),
        const SizedBox(height: 20),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.lcd.designerGestionnaire,
          loading: _loading,
          onPressed: !valide
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final body = inviter
                      ? {
                          'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
                          'telephone': _tel.text.trim().isEmpty ? null : normaliserTelephone(_tel.text) ?? _tel.text.trim(),
                          'canal': _canal,
                        }
                      : {'utilisateur_id': _userId.text.trim(), 'canal': _canal};
                  final r = await ref.read(apiClientProvider).post<LcdGestionnaireResult>('/lcd/declarations/${widget.declaration.id}/gestionnaire', body: body, parse: (j) => LcdGestionnaireResult.fromJson(asMap(j)));
                  if (!context.mounted) return;
                  switch (r) {
                    case ApiOk<LcdGestionnaireResult>(:final data):
                      widget.onDone();
                      ref.invalidate(invitationsProvider);
                      if (data.invitation != null) {
                        setState(() {
                          _loading = false;
                          _invitation = data.invitation;
                        });
                      } else {
                        Navigator.pop(context);
                        showToast(context, md.lcdGestionnaireDesigne);
                      }
                    case ApiFail<LcdGestionnaireResult>():
                      setState(() {
                        _loading = false;
                        _fail = r;
                      });
                  }
                },
          fail: _fail,
        ),
      ],
    );
  }
}

/// Contacts de la déclaration (plateformes, contact d'urgence) — PATCH.
class _ContactsForm extends ConsumerStatefulWidget {
  const _ContactsForm({required this.declaration, required this.onDone});
  final LcdDeclaration declaration;
  final VoidCallback onDone;
  @override
  ConsumerState<_ContactsForm> createState() => _ContactsFormState();
}

class _ContactsFormState extends ConsumerState<_ContactsForm> {
  late final _plateformes = TextEditingController(text: widget.declaration.plateformes?.join(', ') ?? '');
  late final _nom = TextEditingController(text: widget.declaration.contactUrgenceNom ?? '');
  late final _tel = TextEditingController(text: widget.declaration.contactUrgenceTelephone ?? '');
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.lcd.plateformes, controller: _plateformes, hint: d.lcd.plateformesAide, optionalLabel: d.common.optional, error: fieldError(_fail, 'plateformes')),
        const SizedBox(height: 16),
        SuField(label: d.lcd.contactUrgenceNom, controller: _nom, optionalLabel: d.common.optional, error: fieldError(_fail, 'contact_urgence_nom')),
        const SizedBox(height: 16),
        SuField(label: d.lcd.contactUrgenceTelephone, controller: _tel, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, optionalLabel: d.common.optional, error: fieldError(_fail, 'contact_urgence_telephone')),
        const SizedBox(height: 20),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.save,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final plateformes = _plateformes.text.split(RegExp(r'[,;\n]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
            final r = await ref.read(apiClientProvider).patch<LcdDeclaration>('/lcd/declarations/${widget.declaration.id}', body: {
              'plateformes': plateformes,
              'contact_urgence_nom': _nom.text.trim().isEmpty ? null : _nom.text.trim(),
              'contact_urgence_telephone': _tel.text.trim().isEmpty ? null : normaliserTelephone(_tel.text) ?? _tel.text.trim(),
            }, parse: (j) => LcdDeclaration.fromJson(asMap(j)));
            if (!context.mounted) return;
            switch (r) {
              case ApiOk<LcdDeclaration>():
                widget.onDone();
                Navigator.pop(context);
                showToast(context, d.common.updated);
              case ApiFail<LcdDeclaration>():
                setState(() {
                  _loading = false;
                  _fail = r;
                });
            }
          },
          fail: _fail,
        ),
      ],
    );
  }
}

/// Section « Location courte durée » de la fiche lot — absente (silencieusement) si le rôle n'y
/// a pas accès ou si la synthèse est indisponible.
class LcdLotSection extends ConsumerWidget {
  const LcdLotSection({super.key, required this.lotId});
  final String lotId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    if (!ctx.voitLcd) return const SizedBox.shrink();
    final md = context.mdict;
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final synth = ref.watch(lcdSyntheseProvider(lotId)).valueOrNull;
    if (synth == null) return const SizedBox.shrink();
    final decl = synth.declaration;
    final quota = synth.nuitsQuota;
    final ratio = quota == null || quota == 0 ? null : synth.nuitsUtilisees / quota;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(d.lcd.titre, actionLabel: decl != null ? context.dict.common.see : null, onAction: decl == null ? null : () => context.push('/location-courte-duree/declarations/${decl.id}')),
        SuCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KeyValueRow(d.lcd.regime, '', valueWidget: Align(alignment: AlignmentDirectional.centerEnd, child: StatusBadge(d.enums.regimeLcd[synth.regimeLcd] ?? synth.regimeLcd, variant: regimeLcdVariant[synth.regimeLcd] ?? BadgeVariant.neutral, small: true))),
              KeyValueRow(d.lcd.declarations, '', valueWidget: Align(alignment: AlignmentDirectional.centerEnd, child: StatusBadge(decl == null ? md.lcdStatutNonDeclare : d.enums.statutDeclarationLcd[decl.statut] ?? decl.statut, variant: decl == null ? BadgeVariant.outline : declarationLcdVariant[decl.statut] ?? BadgeVariant.neutral, small: true))),
              if (decl != null) KeyValueRow(d.lcd.gestionnaire, decl.gestionnaireId != null ? md.lcdGestionnaireDesigne : d.lcd.aucunGestionnaire),
              KeyValueRow(fill(d.lcd.nuitsUtilisees, {'annee': synth.annee}), quota == null ? '${synth.nuitsUtilisees}' : '${synth.nuitsUtilisees} / $quota'),
              if (ratio != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Gauge(ratio)),
              KeyValueRow(d.lcd.incidentsLies, '${synth.incidentsLies}'),
            ],
          ),
        ),
        // Derniers séjours : liste Wise à plat sous la tuile.
        if (synth.derniersSejours.isNotEmpty) ...[
          Padding(padding: const EdgeInsets.only(top: 18, bottom: 2), child: Text(d.lcd.derniersSejours, style: t.bodyMedium?.copyWith(color: SuColors.soft, fontWeight: FontWeight.w600))),
          CardList([
            for (final s in synth.derniersSejours.take(3))
              ListRow(key: ValueKey(s.id), leading: IconCircle(Icons.luggage_rounded, tone: sejourTone(s.statut)), title: s.voyageurPrincipalNom, subtitle: '${formatJour(s.jourArrivee, l)} → ${formatJour(s.jourDepart, l)}', trailing: StatusBadge(d.enums.statutSejour[s.statut] ?? s.statut, variant: sejourVariant[s.statut] ?? BadgeVariant.neutral, small: true), onTap: () => context.push('/location-courte-duree/sejours/${s.id}')),
          ]),
        ],
      ],
    );
  }
}
