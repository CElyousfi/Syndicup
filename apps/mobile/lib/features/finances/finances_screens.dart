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

// ── D1 Budgets ────────────────────────────────────────────────────────────────
class BudgetsScreen extends ConsumerWidget {
  const BudgetsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final budgets = ref.watch(budgetsProvider);
    return SuPage(
      title: d.finances.budgets,
      subtitle: d.finances.budgetsSubtitle,
      onRefresh: () async => ref.invalidate(budgetsProvider),
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => _form(context, ref, null), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.finances.creerBudget)) : null,
      children: [
        SuBanner(tone: BannerTone.info, body: d.finances.budgetActifRequis),
        const SizedBox(height: 12),
        AsyncView(budgets, onRetry: () => ref.invalidate(budgetsProvider), data: (list) {
          if (list.isEmpty) return EmptyState(title: d.finances.aucunBudget, hint: ctx.isGestion ? d.finances.aucunBudgetAide : null, icon: Icons.account_balance_wallet_rounded);
          final sorted = [...list]..sort((a, b) => b.exercice.compareTo(a.exercice));
          return CardList([
            for (final b in sorted)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  children: [
                    const IconCircle(Icons.account_balance_wallet_rounded, tone: Tone.sand, size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${d.finances.exercice} ${b.exercice}', style: t.titleSmall),
                          MoneyText(formatMAD(b.montantTotal, l), style: t.bodySmall),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        StatusBadge(d.enums.statutBudget[b.statut] ?? b.statut, variant: budgetVariant[b.statut] ?? BadgeVariant.neutral, small: true),
                        if (ctx.isGestion && b.statut != 'ACTIF' && b.statut != 'REMPLACE')
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (b.statut == 'PROPOSE') TextButton(style: TextButton.styleFrom(minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 8)), onPressed: () => _form(context, ref, b), child: Text(d.common.modify)),
                              TextButton(style: TextButton.styleFrom(minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 8)), onPressed: () => _activer(context, ref, b), child: Text(d.finances.activerBudget)),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
          ]);
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
    return Scaffold(
      appBar: racine ? ShellHeader(title: d.finances.appels) : AppBar(title: Text(d.finances.appels)),
      floatingActionButton: ctx.isGestion ? FloatingActionButton.extended(onPressed: _generer, backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.finances.genererAppel)) : null,
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(syntheseProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            Text(d.finances.appelsSubtitle, style: t.bodySmall),
            const SizedBox(height: 12),
            AsyncView(synthese, onRetry: () => ref.invalidate(syntheseProvider), data: (s) {
              if (s.appels.isEmpty) return EmptyState(title: d.finances.aucunAppel, hint: ctx.isGestion ? d.finances.aucunAppelAide : null, icon: Icons.request_quote_rounded, actionLabel: ctx.isGestion ? d.finances.genererAppel : null, onAction: _generer);
              final tot = totauxGlobaux(s);
              final totaux = totauxParAppel(s);
              return Column(
                children: [
                  if (ctx.voitFinancesGlobales)
                    TwoCols([
                      StatTile(label: d.finances.tauxPaiement, value: formatPourcent(tot.taux), tone: Tone.sage),
                      StatTile(label: d.dash.impayes, value: formatMAD(versChaine(tot.impaye), l), tone: Tone.sand),
                    ]),
                  const SizedBox(height: 12),
                  CardList([
                    for (final a in s.appels)
                      InkWell(
                        onTap: () => context.push('/finances/appels-de-fonds/${a.id}'),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(child: Text(formatPeriode(a.periode, l), style: t.titleSmall)),
                                  StatusBadge(d.enums.statutAppel[a.statut] ?? a.statut, variant: appelVariant[a.statut] ?? BadgeVariant.neutral, small: true),
                                ],
                              ),
                              Text('${d.enums.typeAppel[a.type] ?? a.type} · ${d.finances.echeance} ${formatDateCourte(a.dateEcheance, l)}', style: t.labelSmall),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(child: Gauge(totaux[a.id]?.taux ?? 0)),
                                  const SizedBox(width: 10),
                                  MoneyText('${formatMontant(versChaine(totaux[a.id]?.paye ?? BigInt.zero))} / ${formatMAD(a.montantTotal, l)}', style: t.labelSmall?.copyWith(color: SuColors.ink)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                  ]),
                ],
              );
            }),
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
                Navigator.pop(context);
                context.push('/finances/appels-de-fonds/${data.id}');
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
    final t = Theme.of(context).textTheme;
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
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => showPaiementSheet(context, ref, appel: appel.valueOrNull), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.payments_rounded), label: Text(d.finances.enregistrerPaiement)) : null,
      children: [
        AsyncView(appel, onRetry: () => ref.invalidate(appelProvider(id)), data: (a) {
          final du = sommeCentimes(a.lignes.map((x) => x.montantDu));
          final paye = sommeCentimes(a.lignes.map((x) => x.montantPaye));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SuCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [Expanded(child: MoneyText(formatMAD(a.montantTotal, l), style: t.displaySmall)), StatusBadge(d.enums.statutAppel[a.statut] ?? a.statut, variant: appelVariant[a.statut] ?? BadgeVariant.neutral)]),
                    const SizedBox(height: 4),
                    Text('${d.finances.echeance} · ${formatDate(a.dateEcheance, l)}', style: t.bodySmall),
                    const SizedBox(height: 12),
                    Gauge(ratio(paye, du)),
                    const SizedBox(height: 8),
                    Row(children: [Expanded(child: Text('${d.finances.paye} ${formatMAD(versChaine(paye), l)}', style: t.labelSmall)), Text('${d.finances.montantReparti.split('.').first} ${formatMAD(versChaine(du), l)}', style: t.labelSmall, textAlign: TextAlign.end)]),
                  ],
                ),
              ),
              SectionHeader(d.finances.lignes, subtitle: d.finances.lignesSubtitle),
              CardList([
                for (final li in a.lignes)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(lotParId[li.lotId] == null ? li.lotId.substring(0, 8) : '${d.enums.typeLot[lotParId[li.lotId]!.typeLot]} ${lotParId[li.lotId]!.numero}', style: t.titleSmall),
                              const SizedBox(height: 4),
                              Wrap(spacing: 6, runSpacing: 4, children: [
                                StatusBadge(d.enums.statutLigne[li.statut] ?? li.statut, variant: ligneAppelVariant[li.statut] ?? BadgeVariant.neutral, small: true),
                                StatusBadge(d.enums.escalade[li.niveauEscalade] ?? li.niveauEscalade, variant: escaladeVariant(li.niveauEscalade), small: true),
                                if (li.conteste) StatusBadge(d.enums.conteste, variant: BadgeVariant.warn, small: true),
                              ]),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            MoneyText(formatMontant(li.montantDu), style: t.titleSmall),
                            Text('${d.finances.paye.toLowerCase()} ${formatMontant(li.montantPaye)}', style: t.labelSmall),
                            if (ctx.isGestion && li.statut != 'PAYE')
                              TextButton(style: TextButton.styleFrom(minimumSize: const Size(0, 32), padding: const EdgeInsets.symmetric(horizontal: 6)), onPressed: () => showPaiementSheet(context, ref, appel: a, ligneInitiale: li.id), child: Text(d.finances.enregistrerPaiement)),
                          ],
                        ),
                      ],
                    ),
                  ),
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
  PaiementResult? _resultat;

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
    final resultat = _resultat;
    if (resultat != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SuBanner(tone: BannerTone.ok, title: d.finances.paiementEnregistre, body: resultat.quittance != null ? d.finances.quittanceGeneree : ''),
          if (resultat.fifo && resultat.affectations.isNotEmpty) ...[
            SectionHeader(d.finances.fifoRepartition),
            CardList([
              for (final a in resultat.affectations)
                ListRow(title: formatMAD(a.montant, l), trailing: StatusBadge(a.statut == 'PAYE' ? d.finances.fifoLigneSoldee : d.finances.fifoLignePartielle, variant: ligneAppelVariant[a.statut] ?? BadgeVariant.neutral, small: true)),
            ]),
          ],
          const SizedBox(height: 14),
          if (resultat.quittance != null) FilledButton(onPressed: () {
            Navigator.pop(context);
            context.push('/finances/quittances/${resultat.quittance!.id}');
          }, child: Text(d.finances.voirQuittance)),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () => Navigator.pop(context), child: Text(d.common.close)),
        ],
      );
    }
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
        setState(() {
          _loading = false;
          _resultat = data;
        });
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
              SuCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.asset('assets/images/logo.png', width: 28, height: 28)), const SizedBox(width: 8), Expanded(child: Text(ctx.copropriete?.nom ?? '', style: t.titleSmall)), StatusBadge(d.enums.statutLigne['PAYE']!, variant: BadgeVariant.ok, small: true)]),
                    Text('${ctx.copropriete?.adresse ?? ''} · ${ctx.copropriete?.ville ?? ''}', style: t.labelSmall),
                    const Divider(height: 28),
                    Text('${d.finances.quittanceNumero.toUpperCase()} ${qt.numero}', style: t.labelSmall?.copyWith(letterSpacing: 1, fontFamily: 'GeistMono')),
                    const SizedBox(height: 12),
                    KeyValueRow(d.invitations.lot, lot == null ? '—' : '${lot.numero} · ${d.enums.typeLot[lot.typeLot]}'),
                    KeyValueRow(d.lots.proprietaire, proprietaire == null || proprietaire.isEmpty ? '—' : proprietaire),
                    KeyValueRow(d.finances.periode, appel == null ? '—' : formatPeriode(appel.periode, l)),
                    KeyValueRow(d.finances.methode, paiement.isEmpty ? '—' : (d.enums.methodePaiement[paiement.first.methode] ?? paiement.first.methode)),
                    KeyValueRow(d.finances.emiseLe, formatDate(qt.dateEmission, l)),
                    const Divider(height: 24),
                    Text(d.finances.montant, style: t.labelSmall),
                    MoneyText(formatMAD(ligne?.montantPaye ?? paiement.firstOrNull?.montant, l), style: t.displaySmall),
                    const SizedBox(height: 14),
                    Text(d.finances.quittanceCorps, style: t.labelSmall),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SuBanner(tone: BannerTone.info, body: d.finances.quittanceConservation),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => ouvrirFichierApi(context, ref, endpoint: '/finances/quittances/$id/pdf', titre: '${d.finances.quittanceNumero} ${qt.numero}'),
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
          if (cs.isEmpty) return EmptyState(title: d.finances.aucuneContestation, icon: Icons.balance_rounded);
          return CardList([
            for (final c in cs)
              Builder(builder: (context) {
                final ligne = synthese.lignes.where((x) => x.id == c.appelDeFondsLotId).firstOrNull;
                final appel = ligne == null ? null : synthese.appels.where((a) => a.id == ligne.appelDeFondsId).firstOrNull;
                final lot = ligne == null ? null : lots.where((x) => x.id == ligne.lotId).firstOrNull;
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [Expanded(child: Text(appel == null ? c.appelDeFondsLotId.substring(0, 8) : '${d.enums.typeAppel[appel.type]} · ${formatPeriode(appel.periode, l)}${lot != null ? ' · ${lot.numero}' : ''}', style: t.titleSmall)), StatusBadge(d.enums.statutContestation[c.statut] ?? c.statut, variant: contestationVariant[c.statut] ?? BadgeVariant.neutral, small: true)]),
                      const SizedBox(height: 4),
                      Text(c.motif, style: t.bodyMedium),
                      Text('${formatDateHeure(c.creeLe, l)}${ligne != null ? ' · ${formatMAD(ligne.montantDu, l)}' : ''}', style: t.labelSmall),
                      if (c.reponseSyndic != null) Padding(padding: const EdgeInsets.only(top: 8), child: SuBanner(tone: BannerTone.info, title: d.finances.reponseSyndic, body: c.reponseSyndic!)),
                      if (ctx.isGestion && c.statut == 'OUVERTE') Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () => _repondre(context, ref, c), child: Text(d.finances.repondre))),
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
    return Scaffold(
      appBar: racine ? ShellHeader(title: resident ? c.monReleve : c.titre) : AppBar(title: Text(resident ? c.monReleve : c.titre)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(syntheseProvider);
          ref.invalidate(paiementsProvider);
          ref.invalidate(budgetsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
          children: [
            Text(resident ? c.monReleveSubtitle : c.subtitle, style: t.bodySmall),
            const SizedBox(height: 12),
            AsyncView(synthese, onRetry: () => ref.invalidate(syntheseProvider), data: (s) {
              final visibles = resident ? s.lignes.map((x) => x.appelDeFondsId).toSet() : null;
              final annees = s.appels.where((a) => visibles == null || visibles.contains(a.id)).map((a) => a.periode.substring(0, 4)).toSet().toList()..sort((a, b) => b.compareTo(a));
              if (annees.isEmpty) return EmptyState(title: c.aucunExercice, icon: Icons.insights_rounded);
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FilterChips<String>(value: annee, options: annees, labelOf: (a) => '${c.exercice} $a', onChanged: (a) => setState(() => _annee = a)),
                  const SizedBox(height: 12),
                  TwoCols([
                    StatTile(label: resident ? c.appeleResident : c.appele, value: formatMAD(versChaine(du), l), tone: Tone.lilac),
                    StatTile(label: resident ? c.regle : c.encaisse, value: formatMAD(versChaine(paye), l), tone: Tone.sage),
                    StatTile(label: resident ? c.resteAPayer : c.restant, value: formatMAD(versChaine(du - paye), l), tone: Tone.sand, hintColor: SuColors.danger),
                    StatTile(label: resident ? c.partReglee : c.taux, value: formatPourcent(ratio(paye, du)), tone: Tone.tosca),
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
                        return ListRow(title: formatPeriode(p, l), subtitle: '${c.colAppels}: ${appels.where((a) => a.periode == p).length}', trailing: SizedBox(width: 130, child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [MoneyText('${formatMontant(versChaine(pp))} / ${formatMontant(versChaine(pd))}', style: t.labelSmall?.copyWith(color: SuColors.ink)), const SizedBox(height: 5), Gauge(ratio(pp, pd), height: 6)])));
                      }),
                  ]),
                  if (!resident) ...[
                    SectionHeader(c.parLot, subtitle: c.parLotAide),
                    CardList([
                      for (final e in _parLot(lignes))
                        ListRow(
                          leading: IconCircle(Icons.home_rounded, tone: e.$3 > BigInt.zero ? Tone.sand : Tone.sage, size: 36),
                          title: lotParId[e.$1]?.numero ?? e.$1.substring(0, 8),
                          subtitle: '${c.colEscalade}: ${d.enums.escalade[e.$4] ?? e.$4}',
                          trailing: MoneyText(formatMAD(versChaine(e.$3), l), style: t.titleSmall?.copyWith(color: e.$3 > BigInt.zero ? SuColors.danger : SuColors.ok)),
                          onTap: () => context.push('/lots/${e.$1}?onglet=finances'),
                        ),
                    ]),
                  ],
                  SectionHeader(c.journal, subtitle: resident ? c.journalAideResident : c.journalAide),
                  pays.isEmpty
                      ? SuCard(child: Text(resident ? c.aucunPaiementResident : c.aucunPaiement, style: t.bodySmall))
                      : CardList([
                          for (final p in pays.take(30))
                            ListRow(
                              leading: const IconCircle(Icons.payments_rounded, tone: Tone.sage, size: 36),
                              title: formatMAD(p.montant, l),
                              subtitle: '${formatDateHeure(p.horodatage, l)} · ${d.enums.methodePaiement[p.methode] ?? p.methode} · ${lotParId[p.lotId]?.numero ?? ''}',
                              trailing: StatusBadge(p.statut, variant: p.statut == 'VALIDE' ? BadgeVariant.ok : BadgeVariant.neutral, small: true),
                            ),
                        ]),
                  if (resident) ...[
                    const SizedBox(height: 14),
                    SuBanner(tone: BannerTone.info, title: c.residentAideTitre, body: '${c.residentAide1}\n${c.residentAide2}\n${c.residentAide3}'),
                  ],
                ],
              );
            }),
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
