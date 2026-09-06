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
import '../../core/format/centimes.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../rapports/rapports_screens.dart' show ReleveButton;
import '../lcd/lcd_screens.dart';
import '../shell/app_shell.dart';

/// C1 — liste des lots (résident : ses lots ; syndic : tous, avec solde).
class LotsScreen extends ConsumerStatefulWidget {
  const LotsScreen({super.key});
  @override
  ConsumerState<LotsScreen> createState() => _LotsScreenState();
}

class _LotsScreenState extends ConsumerState<LotsScreen> {
  String _type = 'TOUS';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final lots = ref.watch(lotsProvider);
    final synthese = ctx.voitFinancesGlobales || ctx.isProprietaire ? ref.watch(syntheseProvider) : null;
    final soldes = synthese?.valueOrNull == null ? <String, BigInt>{} : soldeParLot(synthese!.valueOrNull!);
    final racine = !context.canPop();
    return Scaffold(
      appBar: racine ? ShellHeader(title: ctx.isResident ? d.lots.mesLots : d.lots.title) : AppBar(title: Text(ctx.isResident ? d.lots.mesLots : d.lots.title)),
      floatingActionButton: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => context.push('/lots/nouveau'), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.lots.nouveau)) : null,
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(lotsProvider);
          ref.invalidate(syntheseProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            PhotoBanner('entree', title: ctx.copropriete?.nom, subtitle: ctx.copropriete?.adresse),
            if (ctx.copropriete != null && !ctx.isResident) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(fill(d.lots.subtitle, {'count': lots.valueOrNull?.length ?? '…', 'tantiemes': formatEntier(ctx.copropriete!.totalTantiemes)}), style: t.bodySmall)),
            TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: InputDecoration(hintText: d.common.search, prefixIcon: const Icon(Icons.search_rounded))),
            const SizedBox(height: 10),
            FilterChips<String>(value: _type, options: ['TOUS', ...d.enums.typeLot.keys], labelOf: (v) => v == 'TOUS' ? d.common.all : d.enums.typeLot[v]!, onChanged: (v) => setState(() => _type = v)),
            const SizedBox(height: 12),
            AsyncView(lots, onRetry: () => ref.invalidate(lotsProvider), data: (list) {
              final visible = list.where((x) => (_type == 'TOUS' || x.typeLot == _type) && (_q.isEmpty || x.numero.toLowerCase().contains(_q))).toList();
              if (visible.isEmpty) return EmptyState(title: d.lots.aucunLot, hint: ctx.isGestion ? d.lots.aucunLotAide : null, icon: Icons.apartment_rounded);
              return CardList([
                for (final x in visible)
                  ListRow(
                    leading: IconCircle(_iconLot(x.typeLot), tone: Tone.lilac, size: 40),
                    title: '${d.enums.typeLot[x.typeLot] ?? x.typeLot} ${x.numero}',
                    subtitle: [
                      if (x.etage != null) '${d.lots.etage} ${x.etage}' else d.lots.rdc,
                      '${formatEntier(x.tantiemes)} ${d.lots.tantiemes.toLowerCase()}',
                      ...x.proprietaires.where((p) => p.actif).map((p) => nomComplet(p.utilisateur?.prenom, p.utilisateur?.nom)).whereType<String>().take(2),
                    ].join(' · '),
                    trailing: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        StatusBadge(d.enums.statutLot[x.statut] ?? x.statut, variant: lotVariant[x.statut] ?? BadgeVariant.neutral, small: true),
                        if (soldes.containsKey(x.id) && soldes[x.id]! > BigInt.zero) Padding(padding: const EdgeInsets.only(top: 4), child: MoneyText(formatMAD(versChaine(soldes[x.id]!), l), style: t.labelSmall?.copyWith(color: SuColors.danger, fontWeight: FontWeight.w700))),
                      ],
                    ),
                    onTap: () => context.push('/lots/${x.id}'),
                  ),
              ]);
            }),
          ],
        ),
      ),
    );
  }
}

IconData _iconLot(String type) => switch (type) {
      'PARKING' => Icons.local_parking_rounded,
      'CAVE' => Icons.inventory_2_rounded,
      'VILLA' => Icons.villa_rounded,
      'COMMERCIAL' || 'LOCAL' => Icons.storefront_rounded,
      'BUREAU' => Icons.business_center_rounded,
      'LOGE_GARDIEN' => Icons.security_rounded,
      'TOIT_TERRASSE' => Icons.roofing_rounded,
      _ => Icons.home_rounded,
    };

/// C2 — fiche lot : propriété / occupation / finances (solde ligne par ligne, contester) /
/// historique. Actions syndic : modifier, rattacher, transférer.
class LotDetailScreen extends ConsumerStatefulWidget {
  const LotDetailScreen({super.key, required this.id, this.onglet});
  final String id;
  final String? onglet;
  @override
  ConsumerState<LotDetailScreen> createState() => _LotDetailScreenState();
}

class _LotDetailScreenState extends ConsumerState<LotDetailScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this, initialIndex: widget.onglet == 'finances' ? 2 : 0);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final lot = ref.watch(lotProvider(widget.id));
    return Scaffold(
      appBar: AppBar(
        title: Text(lot.valueOrNull == null ? d.lots.title : '${d.enums.typeLot[lot.valueOrNull!.typeLot] ?? ''} ${lot.valueOrNull!.numero}'),
        actions: [
          if (ctx.isGestion)
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'modifier') context.push('/lots/${widget.id}/modifier');
                if (v == 'proprietaire') _ajouterProprietaire(context);
                if (v == 'occupant') _ajouterOccupant(context);
                if (v == 'transfert') _transferer(context, lot.valueOrNull);
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'modifier', child: Text(d.common.modify)),
                PopupMenuItem(value: 'proprietaire', child: Text(d.lots.ajouterProprietaire)),
                PopupMenuItem(value: 'occupant', child: Text(d.lots.ajouterOccupant)),
                PopupMenuItem(value: 'transfert', child: Text(d.lots.transferer)),
              ],
            ),
        ],
        bottom: TabBar(controller: _tabs, isScrollable: true, tabAlignment: TabAlignment.start, tabs: [Tab(text: d.lots.onglets.propriete), Tab(text: d.lots.onglets.occupation), Tab(text: d.lots.onglets.finances), Tab(text: d.lots.onglets.historique)]),
      ),
      body: AsyncView(
        lot,
        onRetry: () => ref.invalidate(lotProvider(widget.id)),
        loading: const Padding(padding: EdgeInsets.all(16), child: LoadingList()),
        data: (x) => TabBarView(
          controller: _tabs,
          children: [
            _Propriete(lot: x),
            _Occupation(lot: x),
            _Finances(lot: x),
            _Historique(lot: x),
          ],
        ),
      ),
    );
  }

  Future<void> _ajouterProprietaire(BuildContext context) async {
    await showFormSheet<void>(context, title: context.dict.lots.ajouterProprietaire, builder: (_) => _ProprietaireForm(lotId: widget.id, onDone: () => ref.invalidate(lotProvider(widget.id))));
  }

  Future<void> _ajouterOccupant(BuildContext context) async {
    await showFormSheet<void>(context, title: context.dict.lots.ajouterOccupant, builder: (_) => _OccupantForm(lotId: widget.id, onDone: () => ref.invalidate(lotProvider(widget.id))));
  }

  Future<void> _transferer(BuildContext context, Lot? lot) async {
    if (lot == null) return;
    await showFormSheet<void>(context, title: context.dict.lots.transfertTitre, builder: (_) => _TransfertForm(lot: lot, onDone: () => ref.invalidate(lotProvider(widget.id))));
  }
}

class _EnTete extends StatelessWidget {
  const _EnTete(this.lot);
  final Lot lot;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return SuCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          IconCircle(_iconLot(lot.typeLot), tone: Tone.lilac, size: 48),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${d.enums.typeLot[lot.typeLot] ?? lot.typeLot} ${lot.numero}', style: t.titleMedium),
                Text('${lot.etage != null ? '${d.lots.etage} ${lot.etage}' : d.lots.rdc} · ${d.lots.tantiemes} ${formatEntier(lot.tantiemes)}${lot.superficie != null ? ' · ${lot.superficie} m²' : ''}', style: t.bodySmall),
              ],
            ),
          ),
          StatusBadge(d.enums.statutLot[lot.statut] ?? lot.statut, variant: lotVariant[lot.statut] ?? BadgeVariant.neutral, small: true),
        ],
      ),
    );
  }
}

class _Propriete extends StatelessWidget {
  const _Propriete({required this.lot});
  final Lot lot;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final actifs = lot.proprietaires.where((p) => p.actif).toList();
    final anciens = lot.proprietaires.where((p) => !p.actif).toList();
    Widget ligne(LotProprietaire p) => ListRow(
          leading: Avatar(nomComplet(p.utilisateur?.prenom, p.utilisateur?.nom) ?? '?', size: 36),
          title: nomComplet(p.utilisateur?.prenom, p.utilisateur?.nom) ?? p.utilisateurId.substring(0, 8),
          subtitle: '${d.enums.typePropriete[p.typePropriete] ?? p.typePropriete} · ${d.lots.quotePart} ${p.quotePart} % · ${fill(d.common.sinceDate, {'date': formatDateCourte(p.dateDebut, l)})}${p.dateFin != null ? ' → ${formatDateCourte(p.dateFin, l)}' : ''}',
          trailing: p.estRepresentantIndivision ? const Icon(Icons.star_rounded, color: SuColors.warn) : null,
        );
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _EnTete(lot),
        SectionHeader(d.lots.proprietairesActifs),
        actifs.isEmpty ? SuCard(child: Text(d.common.emptyDefault, style: t.bodySmall)) : CardList([for (final p in actifs) ligne(p)]),
        if (actifs.any((p) => p.estRepresentantIndivision)) Padding(padding: const EdgeInsets.only(top: 8), child: Text('★ ${d.lots.representantIndivision} — ${d.lots.representantAide}', style: t.labelSmall)),
        if (anciens.isNotEmpty) ...[SectionHeader(d.lots.proprietairesHistoriques), CardList([for (final p in anciens) ligne(p)])],
      ],
    );
  }
}

class _Occupation extends StatelessWidget {
  const _Occupation({required this.lot});
  final Lot lot;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _EnTete(lot),
        SectionHeader(d.lots.occupants),
        lot.occupants.isEmpty
            ? SuCard(child: Text(d.lots.aucunOccupant, style: t.bodySmall))
            : CardList([
                for (final o in lot.occupants)
                  ListRow(
                    leading: Avatar(nomComplet(o.utilisateur?.prenom, o.utilisateur?.nom) ?? '?', size: 36),
                    title: nomComplet(o.utilisateur?.prenom, o.utilisateur?.nom) ?? o.utilisateurId.substring(0, 8),
                    subtitle: '${d.enums.typeOccupation[o.typeOccupation] ?? o.typeOccupation} · ${fill(d.common.sinceDate, {'date': formatDateCourte(o.dateDebut, l)})}${o.accesFinancesAccorde ? ' · ${d.lots.accesFinances}' : ''}',
                    trailing: o.actif ? null : StatusBadge(d.common.hide, variant: BadgeVariant.outline, small: true),
                  ),
              ]),
        // M15 : synthèse location courte durée (absente si le rôle n'y a pas accès).
        LcdLotSection(lotId: lot.id),
      ],
    );
  }
}

/// Onglet finances : solde ligne par ligne (statut, escalade N0→N6, contesté), contester.
class _Finances extends ConsumerWidget {
  const _Finances({required this.lot});
  final Lot lot;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final solde = ref.watch(soldeLotProvider(lot.id));
    final synthese = ref.watch(syntheseProvider);
    final s = synthese.valueOrNull ?? const SyntheseFinanciere();
    final appelParId = {for (final a in s.appels) a.id: a};
    final ligneParId = {for (final x in s.lignes) x.id: x};
    final peutContester = lot.estProprietaire(ctx.profil.id) && !ctx.isGestion;
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(soldeLotProvider(lot.id));
        ref.invalidate(syntheseProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _EnTete(lot),
          AsyncView(solde, onRetry: () => ref.invalidate(soldeLotProvider(lot.id)), data: (so) {
            final du = versCentimes(so.soldeDu);
            final aJour = du <= BigInt.zero;
            final appele = sommeCentimes(so.lignes.map((x) => x.montantDu));
            final paye = sommeCentimes(so.lignes.map((x) => x.montantPaye));
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SuCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [Expanded(child: Text(d.finances.solde, style: t.labelMedium)), StatusBadge(aJour ? d.finances.soldeAJour : d.finances.soldeDu, variant: aJour ? BadgeVariant.ok : BadgeVariant.danger)]),
                      const SizedBox(height: 6),
                      MoneyText(formatMAD(so.soldeDu, l), style: t.displaySmall?.copyWith(color: aJour ? SuColors.ink : SuColors.danger)),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: _Mini(d.finances.du, formatMontant(versChaine(appele)))),
                        Expanded(child: _Mini(d.finances.paye, formatMontant(versChaine(paye)))),
                        Expanded(child: _Mini(d.finances.restant, formatMontant(versChaine(du)))),
                      ]),
                      // M18 — relevé de charges (« état daté ») : propriétaire du lot, syndic, conseil.
                      if (ctx.isGestion || ctx.isConseil || lot.estProprietaire(ctx.profil.id)) ...[
                        const SizedBox(height: 12),
                        Align(alignment: AlignmentDirectional.centerStart, child: ReleveButton(lotId: lot.id, lotNumero: lot.numero)),
                      ],
                    ],
                  ),
                ),
                SectionHeader(d.finances.lignes, subtitle: '${so.lignes.length} ${d.finances.lignes.toLowerCase()}'),
                if (so.lignes.isEmpty)
                  SuCard(child: Text(d.finances.aucunAppel, style: t.bodySmall))
                else
                  CardList([
                    for (final li in so.lignes)
                      Builder(builder: (context) {
                        final full = ligneParId[li.appelDeFondsLotId];
                        final appel = full == null ? null : appelParId[full.appelDeFondsId];
                        final restant = versCentimes(li.montantDu) - versCentimes(li.montantPaye);
                        return Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(appel == null ? d.finances.ligneConcernee : (d.enums.typeAppel[appel.type] ?? appel.type), style: t.titleSmall),
                                        Text(appel == null ? li.appelDeFondsLotId.substring(0, 8) : '${d.finances.periode} ${formatPeriode(appel.periode, l)} · ${d.finances.echeance} ${formatDateCourte(appel.dateEcheance, l)}', style: t.labelSmall),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      MoneyText(formatMontant(li.montantDu), style: t.titleSmall),
                                      Text('${d.finances.paye.toLowerCase()} ${formatMontant(li.montantPaye)}', style: t.labelSmall),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  StatusBadge(d.enums.statutLigne[li.statut] ?? li.statut, variant: ligneAppelVariant[li.statut] ?? BadgeVariant.neutral, small: true),
                                  if (full != null) StatusBadge(d.enums.escalade[full.niveauEscalade] ?? full.niveauEscalade, variant: escaladeVariant(full.niveauEscalade), small: true),
                                  if (li.conteste) StatusBadge(d.enums.conteste, variant: BadgeVariant.warn, small: true),
                                  if (peutContester && !li.conteste && li.statut != 'PAYE')
                                    TextButton(
                                      style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(0, 32)),
                                      onPressed: () => _contester(context, ref, li, appel, restant),
                                      child: Text(d.finances.contester),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }),
                  ]),
                const SizedBox(height: 12),
                SuBanner(tone: BannerTone.info, body: md.calculNote),
              ],
            );
          }),
        ],
      ),
    );
  }

  Future<void> _contester(BuildContext context, WidgetRef ref, SoldeLigne li, AppelDeFonds? appel, BigInt restant) async {
    await showFormSheet<void>(context, title: context.dict.finances.contesterTitre, builder: (_) => _ContesterForm(ligneId: li.appelDeFondsLotId, libelle: appel == null ? '' : '${context.dict.enums.typeAppel[appel.type]} · ${appel.periode} · ${formatMAD(li.montantDu, context.locale)}', onDone: () {
      ref.invalidate(soldeLotProvider(lot.id));
      ref.invalidate(syntheseProvider);
    }));
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: t.labelSmall), MoneyText(value, style: t.titleSmall)]);
  }
}

class _ContesterForm extends ConsumerStatefulWidget {
  const _ContesterForm({required this.ligneId, required this.libelle, required this.onDone});
  final String ligneId, libelle;
  final VoidCallback onDone;
  @override
  ConsumerState<_ContesterForm> createState() => _ContesterFormState();
}

class _ContesterFormState extends ConsumerState<_ContesterForm> {
  final _motif = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.libelle, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuField(label: d.finances.contesterMotif, controller: _motif, maxLines: 4, maxLength: 500, required: true, error: fieldError(_fail, 'motif')),
        const SizedBox(height: 10),
        SuBanner(tone: BannerTone.warn, body: d.finances.contesterMention),
        const SizedBox(height: 12),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.finances.contester,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/finances/contestations', body: {'appel_de_fonds_lot_id': widget.ligneId, 'motif': _motif.text.trim()});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            widget.onDone();
            Navigator.pop(context);
            showToast(context, d.finances.contestationEnvoyee);
          },
        ),
      ],
    );
  }
}

class _Historique extends StatelessWidget {
  const _Historique({required this.lot});
  final Lot lot;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final termines = lot.proprietaires.where((p) => !p.actif).toList()..sort((a, b) => (b.dateFin ?? '').compareTo(a.dateFin ?? ''));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _EnTete(lot),
        SectionHeader(d.lots.onglets.historique),
        termines.isEmpty
            ? SuCard(child: Text(d.lots.historiqueVide, style: t.bodySmall))
            : CardList([
                for (final p in termines)
                  ListRow(leading: const IconCircle(Icons.swap_horiz_rounded, tone: Tone.neutral, size: 36), title: nomComplet(p.utilisateur?.prenom, p.utilisateur?.nom) ?? p.utilisateurId.substring(0, 8), subtitle: '${formatDateCourte(p.dateDebut, l)} → ${formatDateCourte(p.dateFin, l)}'),
              ]),
      ],
    );
  }
}

// ── Formulaires syndic ────────────────────────────────────────────────────────

/// C3 — créer / modifier un lot.
class LotFormScreen extends ConsumerStatefulWidget {
  const LotFormScreen({super.key, this.id});
  final String? id;
  @override
  ConsumerState<LotFormScreen> createState() => _LotFormScreenState();
}

class _LotFormScreenState extends ConsumerState<LotFormScreen> {
  String _type = 'APPARTEMENT';
  String? _usage;
  String? _parent;
  final _numero = TextEditingController();
  final _etage = TextEditingController();
  final _tantiemes = TextEditingController();
  final _superficie = TextEditingController();
  bool _loading = false;
  bool _init = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    if (widget.id != null && !_init) {
      final existing = ref.watch(lotProvider(widget.id!)).valueOrNull;
      if (existing != null) {
        _init = true;
        _type = existing.typeLot;
        _usage = existing.typeUsage;
        _parent = existing.lotParentId;
        _numero.text = existing.numero;
        _etage.text = existing.etage?.toString() ?? '';
        _tantiemes.text = existing.tantiemes;
        _superficie.text = existing.superficie ?? '';
      }
    }
    return SuPage(
      title: widget.id == null ? d.lots.creerTitre : d.lots.modifierTitre,
      children: [
        SuSelect<String>(label: d.lots.type, value: _type, options: d.enums.typeLot.keys.toList(), labelOf: (v) => d.enums.typeLot[v]!, onChanged: (v) => setState(() => _type = v), required: true),
        const SizedBox(height: 12),
        SuField(label: d.lots.numero, controller: _numero, required: true, error: fieldError(_fail, 'numero')),
        const SizedBox(height: 12),
        SuField(label: d.lots.etage, controller: _etage, keyboardType: const TextInputType.numberWithOptions(signed: true), inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[-0-9]'))], error: fieldError(_fail, 'etage'), optionalLabel: d.common.optional),
        const SizedBox(height: 12),
        SuField(label: d.lots.tantiemes, controller: _tantiemes, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, required: true, help: fill(d.lots.tantiemesSur, {'total': formatEntier(ref.read(appContextProvider).copropriete?.totalTantiemes)}), error: fieldError(_fail, 'tantiemes')),
        const SizedBox(height: 12),
        SuField(label: d.lots.superficie, controller: _superficie, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, optionalLabel: d.common.optional, error: fieldError(_fail, 'superficie')),
        const SizedBox(height: 12),
        SuSelect<String?>(label: d.lots.typeUsage, value: _usage, options: [null, ...d.lots.usages.keys], labelOf: (v) => v == null ? d.common.none : d.lots.usages[v]!, onChanged: (v) => setState(() => _usage = v)),
        const SizedBox(height: 12),
        SuSelect<String?>(label: d.lots.lotParent, value: _parent, options: [null, ...lots.where((x) => x.id != widget.id).map((x) => x.id)], labelOf: (v) => v == null ? d.common.none : lots.where((x) => x.id == v).map((x) => '${d.enums.typeLot[x.typeLot]} ${x.numero}').firstOrNull ?? v, onChanged: (v) => setState(() => _parent = v), help: d.lots.lotParentAide),
        const SizedBox(height: 18),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.common.save, loading: _loading, onPressed: _submit),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final body = {
      'type_lot': _type,
      'type_usage': _usage,
      'numero': _numero.text.trim(),
      'etage': _etage.text.trim().isEmpty ? null : int.tryParse(_etage.text.trim()),
      'tantiemes': _tantiemes.text.trim(),
      'superficie': _superficie.text.trim().isEmpty ? null : _superficie.text.trim(),
      'lot_parent_id': _parent,
    };
    final api = ref.read(apiClientProvider);
    final r = widget.id == null ? await api.post<Lot>('/lots', body: body, parse: (j) => Lot.fromJson(asMap(j))) : await api.patch<Lot>('/lots/${widget.id}', body: body, parse: (j) => Lot.fromJson(asMap(j)));
    if (!mounted) return;
    switch (r) {
      case ApiOk<Lot>(:final data):
        ref.invalidate(lotsProvider);
        if (widget.id != null) ref.invalidate(lotProvider(widget.id!));
        showToast(context, context.dict.common.updated);
        context.pushReplacement('/lots/${data.id}');
      case ApiFail<Lot>():
        setState(() {
          _loading = false;
          _fail = r;
        });
    }
  }
}

/// C4 — rattacher un propriétaire (plein / indivision / SCI). L'indivision se saisit d'un bloc
/// (somme des quote-parts = 100 %, jauge en direct).
class _ProprietaireForm extends ConsumerStatefulWidget {
  const _ProprietaireForm({required this.lotId, required this.onDone});
  final String lotId;
  final VoidCallback onDone;
  @override
  ConsumerState<_ProprietaireForm> createState() => _ProprietaireFormState();
}

class _ProprietaireFormState extends ConsumerState<_ProprietaireForm> {
  final List<_Copro> _rows = [_Copro()];
  String _type = 'PLEIN';
  final _date = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final membres = annuaireDepuisLots(ref.watch(lotsProvider).valueOrNull ?? const []);
    final total = _rows.fold(BigInt.zero, (a, r) => a + versCentimes(r.quote.text.trim().isEmpty ? '0' : r.quote.text.trim()));
    final ratio100 = total.toInt() / 10000;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Segmented<String>(value: _type, options: const ['PLEIN', 'INDIVISION', 'SCI'], labelOf: (v) => d.enums.typePropriete[v] ?? v, onChanged: (v) => setState(() {
          _type = v;
          if (v != 'INDIVISION') {
            _rows.removeRange(1, _rows.length);
            _rows.first.quote.text = '100';
          }
        })),
        const SizedBox(height: 14),
        for (int i = 0; i < _rows.length; i++) ...[
          if (_type == 'INDIVISION') Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(fill(d.lots.coproprietaireN, {'n': i + 1}), style: t.labelMedium)),
          _MembreField(label: d.lots.utilisateur, help: d.lots.utilisateurIdAide, controller: _rows[i].user, membres: membres),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: SuField(label: d.lots.quotePart, controller: _rows[i].quote, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, onChanged: (_) => setState(() {}), required: true)),
              if (_type == 'INDIVISION') ...[
                const SizedBox(width: 8),
                Column(
                  children: [
                    const SizedBox(height: 22),
                    IconButton(onPressed: () => setState(() { for (final r in _rows) { r.rep = false; } _rows[i].rep = true; }), icon: Icon(_rows[i].rep ? Icons.star_rounded : Icons.star_border_rounded, color: SuColors.warn), tooltip: d.lots.representantIndivision),
                    if (_rows.length > 1) IconButton(onPressed: () => setState(() => _rows.removeAt(i)), icon: const Icon(Icons.remove_circle_outline_rounded, color: SuColors.faint)),
                  ],
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
        ],
        if (_type == 'INDIVISION') ...[
          OutlinedButton.icon(onPressed: () => setState(() => _rows.add(_Copro())), icon: const Icon(Icons.add_rounded), label: Text(d.lots.ajouterIndivisaire)),
          const SizedBox(height: 10),
          Row(children: [Expanded(child: Gauge(ratio100, color: total == BigInt.from(10000) ? SuColors.ok : SuColors.warn)), const SizedBox(width: 10), Text('${formatMontant(versChaine(total))} %', style: t.labelMedium)]),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('${d.lots.quotePartRegle} · ★ ${d.lots.representantAide}', style: t.bodySmall)),
          const SizedBox(height: 10),
        ],
        SuField(label: d.lots.dateDebut, controller: _date, hint: 'AAAA-MM-JJ', textDirection: TextDirection.ltr, required: true, error: fieldError(_fail, 'date_debut')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.common.add, loading: _loading, onPressed: _submit),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    Map<String, dynamic> row(_Copro r) => {
          'utilisateur_id': r.user.text.trim(),
          'quote_part': r.quote.text.trim(),
          'type_propriete': _type,
          'est_representant_indivision': _type == 'INDIVISION' ? r.rep : false,
          'date_debut': _date.text.trim(),
        };
    final body = _type == 'INDIVISION' ? {'proprietaires': _rows.map(row).toList()} : row(_rows.first);
    final r = await ref.read(apiClientProvider).post<dynamic>('/lots/${widget.lotId}/proprietaires', body: body);
    if (!mounted) return;
    if (r is ApiFail) {
      setState(() {
        _loading = false;
        _fail = r;
      });
      return;
    }
    widget.onDone();
    ref.invalidate(lotsProvider);
    Navigator.pop(context);
    showToast(context, context.dict.common.updated);
  }
}

class _Copro {
  final user = TextEditingController();
  final quote = TextEditingController(text: '100');
  bool rep = false;
}

/// Sélecteur de membre : annuaire (depuis les lots) ou UUID libre.
class _MembreField extends StatelessWidget {
  const _MembreField({required this.label, required this.controller, required this.membres, this.help});
  final String label, controller_ = '';
  final TextEditingController controller;
  final List<MembreOption> membres;
  final String? help;
  @override
  Widget build(BuildContext context) {
    return SuField(
      label: label,
      controller: controller,
      help: help,
      mono: true,
      textDirection: TextDirection.ltr,
      required: true,
      suffix: membres.isEmpty
          ? null
          : IconButton(
              icon: const Icon(Icons.person_search_rounded),
              onPressed: () async {
                final picked = await showModalBottomSheet<MembreOption>(
                  context: context,
                  builder: (ctx) => SafeArea(
                    child: ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                      children: [for (final m in membres) ListTile(leading: Avatar(m.nom, size: 34), title: Text(m.nom), subtitle: Text(m.lots.join(', ')), onTap: () => Navigator.pop(ctx, m))],
                    ),
                  ),
                );
                if (picked != null) controller.text = picked.id;
              },
            ),
    );
  }
}

class _OccupantForm extends ConsumerStatefulWidget {
  const _OccupantForm({required this.lotId, required this.onDone});
  final String lotId;
  final VoidCallback onDone;
  @override
  ConsumerState<_OccupantForm> createState() => _OccupantFormState();
}

class _OccupantFormState extends ConsumerState<_OccupantForm> {
  final _user = TextEditingController();
  final _date = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
  String _type = 'LOCATAIRE';
  bool _finances = false, _convocations = false, _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final membres = annuaireDepuisLots(ref.watch(lotsProvider).valueOrNull ?? const []);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _MembreField(label: d.lots.utilisateur, help: d.lots.utilisateurIdAide, controller: _user, membres: membres),
        const SizedBox(height: 12),
        Segmented<String>(value: _type, options: const ['LOCATAIRE', 'PROPRIETAIRE_OCCUPANT'], labelOf: (v) => d.enums.typeOccupation[v] ?? v, onChanged: (v) => setState(() => _type = v)),
        const SizedBox(height: 12),
        SuField(label: d.lots.dateDebut, controller: _date, hint: 'AAAA-MM-JJ', textDirection: TextDirection.ltr, required: true, error: fieldError(_fail, 'date_debut')),
        const SizedBox(height: 8),
        SuCheckbox(value: _finances, onChanged: (v) => setState(() => _finances = v), label: d.lots.accesFinances, help: d.lots.accesFinancesAide),
        SuCheckbox(value: _convocations, onChanged: (v) => setState(() => _convocations = v), label: d.lots.recoitConvocations),
        const SizedBox(height: 12),
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
            final r = await ref.read(apiClientProvider).post<dynamic>('/lots/${widget.lotId}/occupants', body: {'utilisateur_id': _user.text.trim(), 'type_occupation': _type, 'date_debut': _date.text.trim(), 'acces_finances_accorde': _finances, 'recoit_convocations': _convocations});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            widget.onDone();
            ref.invalidate(lotsProvider);
            Navigator.pop(context);
            showToast(context, d.common.updated);
          },
        ),
      ],
    );
  }
}

/// C5 — transfert de propriété (vente) : solde → coordonnées → confirmation irréversible → code.
class _TransfertForm extends ConsumerStatefulWidget {
  const _TransfertForm({required this.lot, required this.onDone});
  final Lot lot;
  final VoidCallback onDone;
  @override
  ConsumerState<_TransfertForm> createState() => _TransfertFormState();
}

class _TransfertFormState extends ConsumerState<_TransfertForm> {
  final _email = TextEditingController();
  final _tel = TextEditingController();
  bool _dette = false, _loading = false;
  ApiFail? _fail;
  String? _code;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final solde = ref.watch(soldeLotProvider(widget.lot.id)).valueOrNull;
    final du = versCentimes(solde?.soldeDu);
    if (_code != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SuBanner(tone: BannerTone.ok, title: d.lots.transfertReussi, body: d.lots.transfertRappel),
          const SizedBox(height: 14),
          Text(d.lots.transfertCodeInvitation, style: t.labelMedium),
          const SizedBox(height: 6),
          SelectableText(_code!, textDirection: TextDirection.ltr, style: t.displaySmall?.copyWith(fontFamily: 'GeistMono', letterSpacing: 4)),
          const SizedBox(height: 14),
          OutlinedButton.icon(onPressed: () {
            Clipboard.setData(ClipboardData(text: _code!));
            showToast(context, context.mdict.copied);
          }, icon: const Icon(Icons.copy_rounded), label: Text(d.common.copy)),
          const SizedBox(height: 8),
          FilledButton(onPressed: () => Navigator.pop(context), child: Text(d.common.close)),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.lots.transfertEtape1, style: t.titleSmall),
        const SizedBox(height: 6),
        if (solde == null) const LinearProgressIndicator() else if (du <= BigInt.zero) SuBanner(tone: BannerTone.ok, body: d.lots.transfertSoldeNul) else ...[
          SuBanner(tone: BannerTone.warn, title: fill(d.lots.transfertDette, {'montant': formatMAD(solde.soldeDu, context.locale)}), body: d.lots.transfertDetteRepriseAide),
          SuCheckbox(value: _dette, onChanged: (v) => setState(() => _dette = v), label: d.lots.transfertDetteReprise),
        ],
        const SizedBox(height: 14),
        Text(d.lots.transfertEtape2, style: t.titleSmall),
        const SizedBox(height: 4),
        Text(d.lots.transfertCoordonneesAide, style: t.bodySmall),
        const SizedBox(height: 10),
        SuField(label: d.auth.emailLabel, controller: _email, keyboardType: TextInputType.emailAddress, textDirection: TextDirection.ltr, error: fieldError(_fail, 'nouveau_proprietaire.email') ?? fieldError(_fail, 'nouveau_proprietaire')),
        const SizedBox(height: 10),
        SuField(label: d.auth.phoneLabel, controller: _tel, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr, error: fieldError(_fail, 'nouveau_proprietaire.telephone')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.lots.transferer,
          loading: _loading,
          danger: true,
          onPressed: (du > BigInt.zero && !_dette) ? null : () async {
            final ok = await confirmDialog(context, title: d.lots.transfertEtape3, body: d.lots.transfertConfirmeAide, confirmLabel: d.lots.transfertConfirme, danger: true, irreversible: true);
            if (!ok) return;
            setState(() {
              _loading = true;
              _fail = null;
            });
            final tel = _tel.text.trim().isEmpty ? null : (normaliserTelephone(_tel.text) ?? _tel.text.trim());
            final r = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/lots/${widget.lot.id}/transfert-propriete', idempotent: true, body: {
              'nouveau_proprietaire': {'email': _email.text.trim().isEmpty ? null : _email.text.trim(), 'telephone': tel},
              'dette_reprise_acquereur': _dette,
            }, parse: asMap);
            if (!mounted) return;
            switch (r) {
              case ApiOk<Map<String, dynamic>>(:final data):
                widget.onDone();
                ref.invalidate(lotsProvider);
                final inv = data['invitation'];
                setState(() {
                  _loading = false;
                  _code = (inv is Map ? inv['code'] : data['code'])?.toString() ?? '—';
                });
              case ApiFail<Map<String, dynamic>>():
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
