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
import '../documents/document_viewer_screen.dart';
import '../shell/app_shell.dart';

/// Fin de ligne Wise (transactions) : montant gras aligné en fin, ligne secondaire dessous.
class _MontantFin extends StatelessWidget {
  const _MontantFin(this.montant, {this.secondaire, this.color});
  final String montant;
  final Widget? secondaire;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        MoneyText(montant, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w700), color: color),
        if (secondaire != null) ...[const SizedBox(height: 4), secondaire!],
      ],
    );
  }
}

/// Ligne secondaire en texte (sous un montant de fin de ligne).
Widget _sousMontant(BuildContext context, String s) => Text(s, style: Theme.of(context).textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis);

/// En-tête de détail Wise : grande pastille, gros montant, légende ardoise, statuts — posé à plat
/// sur la toile, avant les détails.
class _Resume extends StatelessWidget {
  const _Resume({required this.icon, required this.montant, this.tone = Tone.sage, this.legende, this.badges = const [], this.bas});
  final IconData icon;
  final String montant;
  final Tone tone;
  final String? legende;
  final List<Widget> badges;
  final Widget? bas;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 22),
      child: Column(
        children: [
          SuEnter(child: IconCircle(icon, tone: tone, size: 64, iconSize: 30)),
          const SizedBox(height: 14),
          SuEnter(index: 1, child: FittedBox(fit: BoxFit.scaleDown, child: MoneyText(montant, style: t.displayMedium))),
          if (legende != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(legende!, style: t.bodyMedium?.copyWith(color: SuColors.soft), textAlign: TextAlign.center)),
          if (badges.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: badges)),
          if (bas != null) Padding(padding: const EdgeInsets.only(top: 18), child: bas!),
        ],
      ),
    );
  }
}

/// Ton de pastille dérivé d'un statut.
Tone _toneDe(BadgeVariant v) => switch (v) {
      BadgeVariant.ok => Tone.ok,
      BadgeVariant.warn => Tone.warn,
      BadgeVariant.danger => Tone.danger,
      BadgeVariant.info => Tone.tosca,
      _ => Tone.neutral,
    };

/// Section secondaire vide : ligne ardoise compacte (pas de carte).
Widget _vide(BuildContext context, String s) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(s, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft)));

// ── D1 Budgets ────────────────────────────────────────────────────────────────
class BudgetsScreen extends ConsumerWidget {
  const BudgetsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final budgets = ref.watch(budgetsProvider);
    return SuPage(
      title: d.finances.budgets,
      subtitle: d.finances.budgetsSubtitle,
      onRefresh: () async => ref.invalidate(budgetsProvider),
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => _form(context, ref, null), icon: const Icon(Icons.add_rounded), label: Text(d.finances.creerBudget)) : null,
      children: [
        SuBanner(tone: BannerTone.info, body: d.finances.budgetActifRequis),
        const SizedBox(height: 12),
        AsyncView(budgets, onRetry: () => ref.invalidate(budgetsProvider), data: (list) {
          if (list.isEmpty) return EmptyState(title: d.finances.aucunBudget, hint: ctx.isGestion ? d.finances.aucunBudgetAide : null, icon: Icons.account_balance_wallet_rounded, illustration: 'empty-appels');
          final sorted = [...list]..sort((a, b) => b.exercice.compareTo(a.exercice));
          final actif = sorted.where((b) => b.statut == 'ACTIF').firstOrNull;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Budget en vigueur : le « solde » de l'écran, en tête.
              if (actif != null)
                _Resume(
                  icon: Icons.account_balance_wallet_rounded,
                  tone: Tone.ok,
                  montant: formatMAD(actif.montantTotal, l),
                  legende: '${d.finances.exercice} ${actif.exercice}',
                  badges: [StatusBadge(d.enums.statutBudget[actif.statut] ?? actif.statut, variant: budgetVariant[actif.statut] ?? BadgeVariant.neutral)],
                ),
              CardList([
                for (final b in sorted)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListRow(
                        leading: IconCircle(Icons.account_balance_wallet_rounded, tone: b.statut == 'ACTIF' ? Tone.ok : Tone.sand),
                        title: '${d.finances.exercice} ${b.exercice}',
                        trailing: _MontantFin(formatMAD(b.montantTotal, l), secondaire: StatusBadge(d.enums.statutBudget[b.statut] ?? b.statut, variant: budgetVariant[b.statut] ?? BadgeVariant.neutral, small: true)),
                      ),
                      if (ctx.isGestion && b.statut != 'ACTIF' && b.statut != 'REMPLACE')
                        Padding(
                          padding: const EdgeInsetsDirectional.only(start: 58, bottom: 6),
                          child: Wrap(
                            spacing: 14,
                            children: [
                              if (b.statut == 'PROPOSE') LinkButton(d.common.modify, onTap: () => _form(context, ref, b)),
                              LinkButton(d.finances.activerBudget, onTap: () => _activer(context, ref, b)),
                            ],
                          ),
                        ),
                    ],
                  ),
              ]),
            ],
          );
        }),
      ],
    );
  }

  Future<void> _activer(BuildContext context, WidgetRef ref, BudgetAg b) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.finances.activerBudgetTitre, body: fill(d.finances.activerBudgetCorps, {'exercice': b.exercice}), confirmLabel: d.finances.activerBudget, irreversible: true);
    if (!ok) return;
    final r = await ref.read(apiClientProvider).post<dynamic>('/finances/budgets/${b.id}/activer', idempotent: true);
    if (!context.mounted) return;
    if (r is ApiFail) {
      showToast(context, r.error.message, error: true);
    } else {
      ref.invalidate(budgetsProvider);
      showToast(context, d.common.updated);
    }
  }

  Future<void> _form(BuildContext context, WidgetRef ref, BudgetAg? b) async {
    await showFormSheet<void>(context, title: b == null ? context.dict.finances.creerBudget : context.dict.finances.modifierBudget, builder: (_) => _BudgetForm(budget: b));
  }
}

class _BudgetForm extends ConsumerStatefulWidget {
  const _BudgetForm({this.budget});
  final BudgetAg? budget;
  @override
  ConsumerState<_BudgetForm> createState() => _BudgetFormState();
}

class _BudgetFormState extends ConsumerState<_BudgetForm> {
  late final _exercice = TextEditingController(text: widget.budget?.exercice ?? DateTime.now().year.toString());
  late final _montant = TextEditingController(text: widget.budget?.montantTotal ?? '');
  String? _agId;
  bool _loading = false;
  ApiFail? _fail;
  @override
  void initState() {
    super.initState();
    _agId = widget.budget?.agId;
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final ags = ref.watch(agListProvider).valueOrNull ?? const <AssembleeGenerale>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.finances.exercice, controller: _exercice, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)], enabled: widget.budget == null, required: true, error: fieldError(_fail, 'exercice'), textDirection: TextDirection.ltr),
        const SizedBox(height: 12),
        SuField(label: '${d.finances.montantVote} (${d.common.mad})', controller: _montant, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, required: true, help: d.finances.montantAide, error: fieldError(_fail, 'montant_total'), textDirection: TextDirection.ltr, mono: true),
        const SizedBox(height: 12),
        SuSelect<String?>(label: d.finances.agLiee, value: _agId, options: [null, ...ags.map((a) => a.id)], labelOf: (v) => v == null ? d.common.none : ags.where((a) => a.id == v).map((a) => '${d.enums.typeAg[a.type]} · ${formatDateCourte(a.dateAg, context.locale)}').firstOrNull ?? v, onChanged: (v) => setState(() => _agId = v)),
        const SizedBox(height: 16),
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
            final api = ref.read(apiClientProvider);
            final r = widget.budget == null
                ? await api.post<dynamic>('/finances/budgets', body: {'exercice': _exercice.text.trim(), 'montant_total': _montant.text.trim(), 'ag_id': _agId})
                : await api.patch<dynamic>('/finances/budgets/${widget.budget!.id}', body: {'montant_total': _montant.text.trim(), if (_agId != null) 'ag_id': _agId});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(budgetsProvider);
            Navigator.pop(context);
            showToast(context, d.common.updated);
          },
        ),
      ],
    );
  }
}

// ── D2 Appels de fonds ────────────────────────────────────────────────────────
class AppelsScreen extends ConsumerStatefulWidget {
  const AppelsScreen({super.key, this.generer = false});
  final bool generer;
  @override
  ConsumerState<AppelsScreen> createState() => _AppelsScreenState();
}

class _AppelsScreenState extends ConsumerState<AppelsScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.generer) WidgetsBinding.instance.addPostFrameCallback((_) => _generer());
  }

  Future<void> _generer() async {
    await showFormSheet<void>(context, title: context.dict.finances.genererAppel, builder: (_) => const _GenererForm());
  }

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final synthese = ref.watch(syntheseProvider);
    final racine = !context.canPop();
    Future<void> refresh() async => ref.invalidate(syntheseProvider);
    final fab = ctx.isGestion ? FloatingActionButton.extended(onPressed: _generer, icon: const Icon(Icons.add_rounded), label: Text(d.finances.genererAppel)) : null;
    final contenu = AsyncView(synthese, onRetry: () => ref.invalidate(syntheseProvider), data: (s) {
      if (s.appels.isEmpty) return EmptyState(title: d.finances.aucunAppel, hint: ctx.isGestion ? d.finances.aucunAppelAide : null, icon: Icons.request_quote_rounded, illustration: 'empty-appels', actionLabel: ctx.isGestion ? d.finances.genererAppel : null, onAction: _generer);
      final tot = totauxGlobaux(s);
      final totaux = totauxParAppel(s);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (ctx.voitFinancesGlobales) ...[
            TwoCols([
              StatTile(icon: Icons.insights_rounded, label: d.finances.tauxPaiement, value: formatPourcent(tot.taux), tone: Tone.sage),
              StatTile(icon: Icons.payments_rounded, label: d.dash.impayes, value: formatMAD(versChaine(tot.impaye), l), tone: Tone.sand),
            ]),
            const SizedBox(height: 18),
          ],
          // Lignes « transaction » Wise : période en titre, montant appelé gras en fin.
          CardList([
            for (final a in s.appels)
              ListRow(
                leading: IconCircle(Icons.request_quote_rounded, tone: a.statut == 'CLOTURE' ? Tone.neutral : Tone.sand),
                title: formatPeriode(a.periode, l),
                subtitle: '${d.enums.typeAppel[a.type] ?? a.type}\n${d.finances.echeance} ${formatDateCourte(a.dateEcheance, l)} · ${formatPourcent(totaux[a.id]?.taux ?? 0)} ${d.finances.paye.toLowerCase()}',
                trailing: _MontantFin(formatMAD(a.montantTotal, l), secondaire: StatusBadge(d.enums.statutAppel[a.statut] ?? a.statut, variant: appelVariant[a.statut] ?? BadgeVariant.neutral, small: true)),
                onTap: () => context.push('/finances/appels-de-fonds/${a.id}'),
              ),
          ]),
        ],
      );
    });
    if (!racine) {
      return SuPage(title: d.finances.appels, subtitle: d.finances.appelsSubtitle, onRefresh: refresh, fab: fab, padding: const EdgeInsets.fromLTRB(16, 0, 16, 96), children: [contenu]);
    }
    return Scaffold(
      appBar: ShellHeader(title: d.finances.appels),
      floatingActionButton: fab,
      body: RefreshIndicator(
        onRefresh: refresh,
        color: SuColors.link,
        backgroundColor: SuColors.surface,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            Text(d.finances.appelsSubtitle, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
            const SizedBox(height: 16),
            contenu,
          ],
        ),
      ),
    );
  }
}

class _GenererForm extends ConsumerStatefulWidget {
  const _GenererForm();
  @override
  ConsumerState<_GenererForm> createState() => _GenererFormState();
}

class _GenererFormState extends ConsumerState<_GenererForm> {
  final _periode = TextEditingController(text: '${DateTime.now().year}-${DateTime.now().month.toString().padLeft(2, '0')}');
  final _montant = TextEditingController();
  final _echeance = TextEditingController(text: DateTime.now().add(const Duration(days: 30)).toIso8601String().substring(0, 10));
  String _type = 'CHARGES_COURANTES';
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.finances.montantReparti, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuField(label: d.finances.periode, controller: _periode, hint: 'AAAA-MM', help: d.finances.periodeAide, required: true, textDirection: TextDirection.ltr, mono: true, error: fieldError(_fail, 'periode')),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.finances.typeAppel, value: _type, options: d.enums.typeAppel.keys.toList(), labelOf: (v) => d.enums.typeAppel[v]!, onChanged: (v) => setState(() => _type = v), required: true),
        const SizedBox(height: 12),
        SuField(label: '${d.finances.montantTotal} (${d.common.mad})', controller: _montant, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, required: true, textDirection: TextDirection.ltr, mono: true, error: fieldError(_fail, 'montant_total')),
        const SizedBox(height: 12),
        SuField(label: d.finances.echeance, controller: _echeance, hint: 'AAAA-MM-JJ', required: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'date_echeance')),
        const SizedBox(height: 16),
        FormError(_fail, onSettings: () => context.push('/finances/budgets')),
        if (_fail?.status == 422) Padding(padding: const EdgeInsets.only(top: 8), child: TextButton(onPressed: () => context.push('/finances/budgets'), child: Text(d.finances.creerBudgetDabord))),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.finances.genererAppel,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<AppelDeFonds>('/finances/appels-de-fonds', idempotent: true, body: {'periode': _periode.text.trim(), 'type': _type, 'montant_total': _montant.text.trim(), 'date_echeance': _echeance.text.trim()}, parse: (j) => AppelDeFonds.fromJson(asMap(j)));
            if (!mounted) return;
            switch (r) {
              case ApiOk<AppelDeFonds>(:final data):
                ref.invalidate(syntheseProvider);
                ref.invalidate(appelsProvider);
                final racine = Navigator.of(this.context, rootNavigator: true).context;
                final l = this.context.locale;
                Navigator.pop(context);
                context.push('/finances/appels-de-fonds/${data.id}');
                // Succès plein écran, posé au-dessus du détail une fois celui-ci empilé.
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (!racine.mounted) return;
                  showSuccess(racine, title: formatPeriode(data.periode, l), body: '${d.enums.typeAppel[data.type] ?? data.type} · ${formatMAD(data.montantTotal, l)}\n${d.finances.montantReparti}', illustration: 'ok-general');
                });
              case ApiFail<AppelDeFonds>():
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

// ── D3 Détail d'un appel + D4 paiement ────────────────────────────────────────
class AppelDetailScreen extends ConsumerWidget {
  const AppelDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final appel = ref.watch(appelProvider(id));
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final lotParId = {for (final x in lots) x.id: x};
    return SuPage(
      title: appel.valueOrNull == null ? d.finances.appels : formatPeriode(appel.valueOrNull!.periode, l),
      subtitle: appel.valueOrNull == null ? null : d.enums.typeAppel[appel.valueOrNull!.type],
      onRefresh: () async {
        ref.invalidate(appelProvider(id));
        ref.invalidate(syntheseProvider);
      },
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => showPaiementSheet(context, ref, appel: appel.valueOrNull), icon: const Icon(Icons.payments_rounded), label: Text(d.finances.enregistrerPaiement)) : null,
      children: [
        AsyncView(appel, onRetry: () => ref.invalidate(appelProvider(id)), data: (a) {
          final du = sommeCentimes(a.lignes.map((x) => x.montantDu));
          final paye = sommeCentimes(a.lignes.map((x) => x.montantPaye));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Resume(
                icon: Icons.request_quote_rounded,
                tone: Tone.sand,
                montant: formatMAD(a.montantTotal, l),
                legende: '${d.finances.echeance} · ${formatDate(a.dateEcheance, l)}',
                badges: [StatusBadge(d.enums.statutAppel[a.statut] ?? a.statut, variant: appelVariant[a.statut] ?? BadgeVariant.neutral)],
                bas: Gauge(ratio(paye, du)),
              ),
              TwoCols([
                StatTile(icon: Icons.payments_rounded, label: d.finances.paye, value: formatMAD(versChaine(paye), l), tone: Tone.sage, hint: formatPourcent(ratio(paye, du))),
                StatTile(icon: Icons.hourglass_bottom_rounded, label: d.finances.restant, value: formatMAD(versChaine(du - paye), l), tone: Tone.sand, hint: '${d.finances.du} ${formatMAD(versChaine(du), l)}'),
              ]),
              SectionHeader(d.finances.lignes, subtitle: d.finances.lignesSubtitle),
              CardList([
                for (final li in a.lignes)
                  Builder(builder: (context) {
                    final lot = lotParId[li.lotId];
                    final payable = ctx.isGestion && li.statut != 'PAYE';
                    final v = ligneAppelVariant[li.statut] ?? BadgeVariant.neutral;
                    return ListRow(
                      leading: IconCircle(Icons.home_rounded, tone: _toneDe(v)),
                      title: lot == null ? li.lotId.substring(0, 8) : '${d.enums.typeLot[lot.typeLot]} ${lot.numero}',
                      subtitle: [
                        '${d.finances.paye} ${formatMAD(li.montantPaye, l)}',
                        if (li.niveauEscalade != 'N0') d.enums.escalade[li.niveauEscalade] ?? li.niveauEscalade,
                        if (li.conteste) d.enums.conteste,
                      ].join(' · '),
                      trailing: _MontantFin(formatMAD(li.montantDu, l), secondaire: StatusBadge(d.enums.statutLigne[li.statut] ?? li.statut, variant: v, small: true)),
                      // Gestion : toucher une ligne non soldée ouvre le paiement ciblé sur elle.
                      onTap: payable ? () => showPaiementSheet(context, ref, appel: a, ligneInitiale: li.id) : null,
                    );
                  }),
              ]),
            ],
          );
        }),
      ],
    );
  }
}

/// D4 — feuille « Enregistrer un paiement » (ciblé / FIFO), Idempotency-Key, quittance auto.
Future<void> showPaiementSheet(BuildContext context, WidgetRef ref, {AppelDeFonds? appel, String? ligneInitiale, String? lotInitial}) {
  return showFormSheet<void>(context, title: context.dict.finances.paiementTitre, builder: (_) => _PaiementForm(appel: appel, ligneInitiale: ligneInitiale, lotInitial: lotInitial));
}

class _PaiementForm extends ConsumerStatefulWidget {
  const _PaiementForm({this.appel, this.ligneInitiale, this.lotInitial});
  final AppelDeFonds? appel;
  final String? ligneInitiale, lotInitial;
  @override
  ConsumerState<_PaiementForm> createState() => _PaiementFormState();
}

class _PaiementFormState extends ConsumerState<_PaiementForm> {
  late String _mode = widget.ligneInitiale != null || widget.lotInitial == null ? 'cible' : 'fifo';
  String? _ligne;
  String? _lot;
  final _montant = TextEditingController();
  String _methode = 'ESPECES';
  final _payeur = TextEditingController();
  bool _tropPercu = false, _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    _ligne = widget.ligneInitiale;
    _lot = widget.lotInitial;
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final synthese = ref.watch(syntheseProvider).valueOrNull ?? const SyntheseFinanciere();
    final lotParId = {for (final x in lots) x.id: x};
    final appelParId = {for (final a in synthese.appels) a.id: a};
    final lignes = (widget.appel?.lignes ?? synthese.lignes).where((x) => x.statut != 'PAYE').toList();
    String libelleLigne(AppelDeFondsLigne x) {
      final a = appelParId[x.appelDeFondsId] ?? widget.appel;
      final lot = lotParId[x.lotId];
      final restant = versCentimes(x.montantDu) - versCentimes(x.montantPaye);
      return '${lot?.numero ?? x.lotId.substring(0, 6)} · ${a == null ? '' : formatPeriode(a.periode, l)} · ${formatMAD(versChaine(restant), l)}';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Segmented<String>(value: _mode, options: const ['cible', 'fifo'], labelOf: (m) => m == 'cible' ? d.finances.paiementCible : d.finances.paiementFifo, onChanged: (m) => setState(() => _mode = m)),
        const SizedBox(height: 14),
        if (_mode == 'cible')
          SuSelect<String>(label: d.finances.ligneConcernee, value: _ligne, options: lignes.map((x) => x.id).toList(), labelOf: (id) => libelleLigne(lignes.firstWhere((x) => x.id == id)), onChanged: (v) => setState(() => _ligne = v), help: d.finances.paiementLigneAide, required: true, placeholder: md.selectLot)
        else
          SuSelect<String>(label: d.espaces.pourLot, value: _lot, options: lots.map((x) => x.id).toList(), labelOf: (id) => '${d.enums.typeLot[lotParId[id]!.typeLot]} ${lotParId[id]!.numero}', onChanged: (v) => setState(() => _lot = v), help: d.finances.paiementFifoAide, required: true, placeholder: md.selectLot),
        const SizedBox(height: 12),
        SuField(label: '${d.finances.montant} (${d.common.mad})', controller: _montant, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, required: true, textDirection: TextDirection.ltr, mono: true, error: fieldError(_fail, 'montant')),
        const SizedBox(height: 12),
        Text(d.finances.methode, style: t.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 6),
        Segmented<String>(value: _methode, options: const ['ESPECES', 'VIREMENT', 'CHEQUE'], labelOf: (m) => d.enums.methodePaiement[m] ?? m, onChanged: (m) => setState(() => _methode = m)),
        const SizedBox(height: 12),
        SuField(label: d.finances.payeur, controller: _payeur, help: d.finances.payeurAide, optionalLabel: d.common.optional, mono: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'payeur_utilisateur_id')),
        if (_mode == 'cible') ...[const SizedBox(height: 8), SuCheckbox(value: _tropPercu, onChanged: (v) => setState(() => _tropPercu = v), label: d.finances.tropPercu, help: d.finances.tropPercuAide)],
        const SizedBox(height: 8),
        Text('${_mode == 'fifo' ? d.finances.avanceNonSupportee : ''} ${md.retryHint}', style: t.labelSmall),
        const SizedBox(height: 12),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(label: d.finances.enregistrerPaiement, loading: _loading, onPressed: (_mode == 'cible' ? _ligne == null : _lot == null) ? null : _submit),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _fail = null;
    });
    final body = <String, dynamic>{
      'montant': _montant.text.trim(),
      'methode': _methode,
      if (_payeur.text.trim().isNotEmpty) 'payeur_utilisateur_id': _payeur.text.trim(),
      if (_mode == 'fifo') 'lot_id': _lot else ...{'appel_de_fonds_lot_id': _ligne, 'accepter_trop_percu': _tropPercu},
    };
    final r = await ref.read(apiClientProvider).post<PaiementResult>('/finances/paiements', idempotent: true, body: body, parse: (j) => PaiementResult.fromJson(asMap(j)));
    if (!mounted) return;
    switch (r) {
      case ApiOk<PaiementResult>(:final data):
        ref.invalidate(syntheseProvider);
        ref.invalidate(appelsProvider);
        ref.invalidate(paiementsProvider);
        if (widget.appel != null) ref.invalidate(appelProvider(widget.appel!.id));
        // Succès plein écran Wise : quittance + répartition FIFO dans le corps, « Voir la
        // quittance » en action de suite (après fermeture du succès).
        final d = context.dict;
        final l = context.locale;
        final racine = Navigator.of(context, rootNavigator: true).context;
        final router = GoRouter.of(context);
        final quittance = data.quittance;
        final corps = [
          if (quittance != null) d.finances.quittanceGeneree,
          if (data.fifo && data.affectations.isNotEmpty) ...[
            d.finances.fifoRepartition,
            for (final a in data.affectations) '${formatMAD(a.montant, l)} · ${a.statut == 'PAYE' ? d.finances.fifoLigneSoldee : d.finances.fifoLignePartielle}',
          ],
        ];
        Navigator.pop(context);
        if (!racine.mounted) return;
        showSuccess(
          racine,
          title: d.finances.paiementEnregistre,
          body: corps.isEmpty ? null : corps.join('\n'),
          illustration: 'ok-paiement',
          secondaryLabel: quittance == null ? null : d.finances.voirQuittance,
          onSecondary: quittance == null ? null : () => router.push('/finances/quittances/${quittance.id}'),
        );
      case ApiFail<PaiementResult>():
        setState(() {
          _loading = false;
          _fail = r;
        });
    }
  }
}

// ── D5 Quittance ──────────────────────────────────────────────────────────────
class QuittanceScreen extends ConsumerWidget {
  const QuittanceScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final q = ref.watch(quittanceProvider(id));
    final synthese = ref.watch(syntheseProvider).valueOrNull ?? const SyntheseFinanciere();
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final paiements = ref.watch(paiementsProvider).valueOrNull ?? const <Paiement>[];
    return SuPage(
      title: d.finances.quittance,
      children: [
        AsyncView(q, onRetry: () => ref.invalidate(quittanceProvider(id)), data: (qt) {
          final ligne = synthese.lignes.where((x) => x.id == qt.appelDeFondsLotId).firstOrNull;
          final appel = ligne == null ? null : synthese.appels.where((a) => a.id == ligne.appelDeFondsId).firstOrNull;
          final lot = ligne == null ? null : lots.where((x) => x.id == ligne.lotId).firstOrNull;
          final paiement = paiements.where((p) => p.appelDeFondsLotId == qt.appelDeFondsLotId).toList()..sort((a, b) => b.horodatage.compareTo(a.horodatage));
          final proprietaire = lot?.proprietaires.where((p) => p.actif).map((p) => nomComplet(p.utilisateur?.prenom, p.utilisateur?.nom)).whereType<String>().join(', ');
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Reçu Wise : montant réglé en grand, statut, puis le détail de la quittance.
              _Resume(
                icon: Icons.verified_rounded,
                tone: Tone.ok,
                montant: formatMAD(ligne?.montantPaye ?? paiement.firstOrNull?.montant, l),
                legende: appel == null ? d.finances.quittance : '${d.finances.quittance} · ${formatPeriode(appel.periode, l)}',
                badges: [StatusBadge(d.enums.statutLigne['PAYE']!, variant: BadgeVariant.ok)],
              ),
              SuCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.asset('assets/images/logo.png', width: 32, height: 32)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(ctx.copropriete?.nom ?? '', style: t.titleMedium),
                          Text('${ctx.copropriete?.adresse ?? ''} · ${ctx.copropriete?.ville ?? ''}', style: t.bodySmall),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 12),
                    KeyValueRow(fill(d.finances.quittanceNumero, {'numero': ''}).replaceAll(RegExp(r'\s+$'), ''), qt.numero, mono: true),
                    KeyValueRow(d.invitations.lot, lot == null ? '—' : '${lot.numero} · ${d.enums.typeLot[lot.typeLot]}'),
                    KeyValueRow(d.lots.proprietaire, proprietaire == null || proprietaire.isEmpty ? '—' : proprietaire),
                    KeyValueRow(d.finances.periode, appel == null ? '—' : formatPeriode(appel.periode, l)),
                    KeyValueRow(d.finances.methode, paiement.isEmpty ? '—' : (d.enums.methodePaiement[paiement.first.methode] ?? paiement.first.methode)),
                    KeyValueRow(d.finances.emiseLe, formatDate(qt.dateEmission, l)),
                    KeyValueRow(d.finances.montant, formatMAD(ligne?.montantPaye ?? paiement.firstOrNull?.montant, l)),
                    const SizedBox(height: 10),
                    Text(d.finances.quittanceCorps, style: t.bodySmall),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SuBanner(tone: BannerTone.info, body: d.finances.quittanceConservation),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () => ouvrirPdfApi(context, ref, endpoint: '/finances/quittances/$id/pdf', titre: fill(d.finances.quittanceNumero, {'numero': qt.numero})),
                icon: const Icon(Icons.picture_as_pdf_rounded),
                label: Text('${d.common.download} · PDF'),
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

// ── D6 Contestations ──────────────────────────────────────────────────────────
class ContestationsScreen extends ConsumerWidget {
  const ContestationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final list = ref.watch(contestationsProvider);
    final synthese = ref.watch(syntheseProvider).valueOrNull ?? const SyntheseFinanciere();
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    return SuPage(
      title: d.finances.contestations,
      subtitle: d.finances.contestationsSubtitle,
      onRefresh: () async => ref.invalidate(contestationsProvider),
      children: [
        AsyncView(list, onRetry: () => ref.invalidate(contestationsProvider), data: (cs) {
          if (cs.isEmpty) return EmptyState(title: d.finances.aucuneContestation, icon: Icons.balance_rounded, illustration: 'empty-litiges');
          return CardList([
            for (final c in cs)
              Builder(builder: (context) {
                final ligne = synthese.lignes.where((x) => x.id == c.appelDeFondsLotId).firstOrNull;
                final appel = ligne == null ? null : synthese.appels.where((a) => a.id == ligne.appelDeFondsId).firstOrNull;
                final lot = ligne == null ? null : lots.where((x) => x.id == ligne.lotId).firstOrNull;
                final v = contestationVariant[c.statut] ?? BadgeVariant.neutral;
                final badge = StatusBadge(d.enums.statutContestation[c.statut] ?? c.statut, variant: v, small: true);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ListRow(
                        leading: IconCircle(Icons.balance_rounded, tone: _toneDe(v)),
                        title: appel == null ? c.appelDeFondsLotId.substring(0, 8) : '${d.enums.typeAppel[appel.type]} · ${formatPeriode(appel.periode, l)}${lot != null ? ' · ${lot.numero}' : ''}',
                        subtitle: formatDateHeure(c.creeLe, l),
                        trailing: ligne != null ? _MontantFin(formatMAD(ligne.montantDu, l), secondaire: badge) : badge,
                      ),
                      // Motif en entier, réponse du syndic, action — alignés sous le titre.
                      Padding(
                        padding: const EdgeInsetsDirectional.only(start: 62),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(c.motif, style: t.bodyMedium?.copyWith(color: SuColors.ink)),
                            if (c.reponseSyndic != null) Padding(padding: const EdgeInsets.only(top: 10), child: SuBanner(tone: BannerTone.info, title: d.finances.reponseSyndic, body: c.reponseSyndic!)),
                            if (ctx.isGestion && c.statut == 'OUVERTE') Padding(padding: const EdgeInsets.only(top: 4), child: LinkButton(d.finances.repondre, onTap: () => _repondre(context, ref, c))),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
          ]);
        }),
      ],
    );
  }

  Future<void> _repondre(BuildContext context, WidgetRef ref, Contestation c) async {
    await showFormSheet<void>(context, title: context.dict.finances.repondre, builder: (_) => _ReponseForm(c: c));
  }
}

class _ReponseForm extends ConsumerStatefulWidget {
  const _ReponseForm({required this.c});
  final Contestation c;
  @override
  ConsumerState<_ReponseForm> createState() => _ReponseFormState();
}

class _ReponseFormState extends ConsumerState<_ReponseForm> {
  final _txt = TextEditingController();
  String _statut = 'REPONDUE';
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuSelect<String>(label: d.finances.reponseStatut, value: _statut, options: const ['REPONDUE', 'MEDIEE', 'TRIBUNAL'], labelOf: (v) => d.enums.statutContestation[v] ?? v, onChanged: (v) => setState(() => _statut = v)),
        const SizedBox(height: 12),
        SuField(label: d.finances.votreReponse, controller: _txt, maxLines: 4, required: true, error: fieldError(_fail, 'reponse_syndic')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.send,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/finances/contestations/${widget.c.id}/reponse', body: {'statut': _statut, 'reponse_syndic': _txt.text.trim()});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(contestationsProvider);
            Navigator.pop(context);
            showToast(context, d.finances.reponseEnvoyee);
          },
        ),
      ],
    );
  }
}

// ── Comptabilité / Mon relevé ─────────────────────────────────────────────────
class ComptabiliteScreen extends ConsumerStatefulWidget {
  const ComptabiliteScreen({super.key});
  @override
  ConsumerState<ComptabiliteScreen> createState() => _ComptabiliteScreenState();
}

class _ComptabiliteScreenState extends ConsumerState<ComptabiliteScreen> {
  String? _annee;
  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final c = d.comptabilite;
    final synthese = ref.watch(syntheseProvider);
    final paiements = ref.watch(paiementsProvider).valueOrNull ?? const <Paiement>[];
    final budgets = ref.watch(budgetsProvider).valueOrNull ?? const <BudgetAg>[];
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final resident = !ctx.voitFinancesGlobales;
    final racine = !context.canPop();
    final titre = resident ? c.monReleve : c.titre;
    final sousTitre = resident ? c.monReleveSubtitle : c.subtitle;
    Future<void> refresh() async {
      ref.invalidate(syntheseProvider);
      ref.invalidate(paiementsProvider);
      ref.invalidate(budgetsProvider);
    }

    final contenu = AsyncView(synthese, onRetry: () => ref.invalidate(syntheseProvider), data: (s) {
      final visibles = resident ? s.lignes.map((x) => x.appelDeFondsId).toSet() : null;
      final annees = s.appels.where((a) => visibles == null || visibles.contains(a.id)).map((a) => a.periode.substring(0, 4)).toSet().toList()..sort((a, b) => b.compareTo(a));
      if (annees.isEmpty) return EmptyState(title: c.aucunExercice, icon: Icons.insights_rounded, illustration: 'empty-appels');
      final annee = _annee ?? annees.first;
      final appels = s.appels.where((a) => a.periode.startsWith(annee)).toList();
      final ids = appels.map((a) => a.id).toSet();
      final lignes = s.lignes.where((x) => ids.contains(x.appelDeFondsId)).toList();
      final ligneIds = lignes.map((x) => x.id).toSet();
      final pays = paiements.where((p) => ligneIds.contains(p.appelDeFondsLotId)).toList()..sort((a, b) => b.horodatage.compareTo(a.horodatage));
      final du = sommeCentimes(lignes.map((x) => x.montantDu));
      final paye = sommeCentimes(lignes.map((x) => x.montantPaye));
      final budget = budgets.where((b) => b.exercice.startsWith(annee) && b.statut == 'ACTIF').firstOrNull ?? budgets.where((b) => b.exercice.startsWith(annee)).firstOrNull;
      final parPeriode = <String, List<AppelDeFondsLigne>>{};
      final appelParId = {for (final a in appels) a.id: a};
      for (final x in lignes) {
        final a = appelParId[x.appelDeFondsId];
        if (a != null) parPeriode.putIfAbsent(a.periode, () => []).add(x);
      }
      final periodes = parPeriode.keys.toList()..sort();
      final lotParId = {for (final x in lots) x.id: x};
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilterChips<String>(value: annee, options: annees, labelOf: (a) => '${c.exercice} $a', onChanged: (a) => setState(() => _annee = a)),
          const SizedBox(height: 14),
          TwoCols([
            StatTile(icon: Icons.request_quote_rounded, label: resident ? c.appeleResident : c.appele, value: formatMAD(versChaine(du), l), tone: Tone.lilac),
            StatTile(icon: Icons.payments_rounded, label: resident ? c.regle : c.encaisse, value: formatMAD(versChaine(paye), l), tone: Tone.sage),
            StatTile(icon: Icons.hourglass_bottom_rounded, label: resident ? c.resteAPayer : c.restant, value: formatMAD(versChaine(du - paye), l), tone: du - paye > BigInt.zero ? Tone.warn : Tone.ok),
            StatTile(icon: Icons.insights_rounded, label: resident ? c.partReglee : c.taux, value: formatPourcent(ratio(paye, du)), tone: Tone.tosca),
          ]),
          if (!resident && budget != null) ...[
            SectionHeader(c.budget),
            SuCard(child: Column(children: [
              KeyValueRow(c.budgetVote, formatMAD(budget.montantTotal, l)),
              KeyValueRow(c.budgetAppele, formatMAD(versChaine(sommeCentimes(appels.map((a) => a.montantTotal))), l)),
              KeyValueRow(c.budgetEncaisse, formatMAD(versChaine(paye), l)),
              KeyValueRow(c.budgetEcart, formatMAD(versChaine(versCentimes(budget.montantTotal) - sommeCentimes(appels.map((a) => a.montantTotal))), l)),
            ])),
          ],
          SectionHeader(c.parMois, subtitle: resident ? c.parMoisAideResident : c.parMoisAide),
          CardList([
            for (final p in periodes)
              Builder(builder: (_) {
                final ls = parPeriode[p]!;
                final pd = sommeCentimes(ls.map((x) => x.montantDu));
                final pp = sommeCentimes(ls.map((x) => x.montantPaye));
                return ListRow(
                  leading: IconCircle(Icons.calendar_month_rounded, tone: pp >= pd ? Tone.ok : Tone.sand),
                  title: formatPeriode(p, l),
                  subtitle: '${c.colAppels}: ${appels.where((a) => a.periode == p).length} · ${formatPourcent(ratio(pp, pd))}',
                  trailing: _MontantFin(formatMAD(versChaine(pd), l), secondaire: _sousMontant(context, '${resident ? c.regle : c.encaisse} ${formatMontant(versChaine(pp))}')),
                );
              }),
          ]),
          if (!resident) ...[
            SectionHeader(c.parLot, subtitle: c.parLotAide),
            CardList([
              for (final e in _parLot(lignes))
                ListRow(
                  leading: IconCircle(Icons.home_rounded, tone: e.$3 > BigInt.zero ? Tone.sand : Tone.ok),
                  title: lotParId[e.$1]?.numero ?? e.$1.substring(0, 8),
                  subtitle: '${c.colEscalade}: ${d.enums.escalade[e.$4] ?? e.$4}',
                  trailing: _MontantFin(formatMAD(versChaine(e.$3), l), color: e.$3 > BigInt.zero ? SuColors.danger : SuColors.ok, secondaire: _sousMontant(context, c.restant)),
                  onTap: () => context.push('/lots/${e.$1}?onglet=finances'),
                ),
            ]),
          ],
          SectionHeader(c.journal, subtitle: resident ? c.journalAideResident : c.journalAide),
          if (pays.isEmpty)
            _vide(context, resident ? c.aucunPaiementResident : c.aucunPaiement)
          else
            CardList([
              for (final p in pays.take(30))
                ListRow(
                  leading: IconCircle(p.methode == 'ESPECES' ? Icons.payments_rounded : p.methode == 'CHEQUE' ? Icons.receipt_long_rounded : Icons.account_balance_rounded, tone: Tone.sage),
                  title: [d.enums.methodePaiement[p.methode] ?? p.methode, if (lotParId[p.lotId] != null) lotParId[p.lotId]!.numero].join(' · '),
                  subtitle: formatDateHeure(p.horodatage, l),
                  trailing: _MontantFin(formatMAD(p.montant, l), secondaire: StatusBadge(p.statut, variant: p.statut == 'VALIDE' ? BadgeVariant.ok : BadgeVariant.neutral, small: true)),
                ),
            ]),
          if (resident) ...[
            const SizedBox(height: 18),
            SuBanner(tone: BannerTone.info, title: c.residentAideTitre, body: '${c.residentAide1}\n${c.residentAide2}\n${c.residentAide3}'),
          ],
        ],
      );
    });
    if (!racine) {
      return SuPage(title: titre, subtitle: sousTitre, onRefresh: refresh, children: [contenu]);
    }
    return Scaffold(
      appBar: ShellHeader(title: titre),
      body: RefreshIndicator(
        onRefresh: refresh,
        color: SuColors.link,
        backgroundColor: SuColors.surface,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            Text(sousTitre, style: t.bodyLarge?.copyWith(color: SuColors.soft)),
            const SizedBox(height: 16),
            contenu,
          ],
        ),
      ),
    );
  }

  List<(String, BigInt, BigInt, String)> _parLot(List<AppelDeFondsLigne> lignes) {
    const niv = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
    final g = <String, List<AppelDeFondsLigne>>{};
    for (final x in lignes) {
      g.putIfAbsent(x.lotId, () => []).add(x);
    }
    final out = g.entries.map((e) {
      final du = sommeCentimes(e.value.map((x) => x.montantDu));
      final paye = sommeCentimes(e.value.map((x) => x.montantPaye));
      var esc = 'N0';
      for (final x in e.value.where((x) => x.statut != 'PAYE')) {
        if (niv.indexOf(x.niveauEscalade) > niv.indexOf(esc)) esc = x.niveauEscalade;
      }
      return (e.key, du, du - paye, esc);
    }).toList()
      ..sort((a, b) => b.$3.compareTo(a.$3));
    return out;
  }
}
