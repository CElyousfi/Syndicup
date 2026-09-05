import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

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
import '../documents/document_viewer_screen.dart';
import '../lcd/lcd_sejour_screens.dart' show PieceLocale, choisirPiece;

/// M16 Dépenses (Doc A §3, §8) — mobile : liste et détail (syndic, conseil), approbation /
/// rejet du conseil (push → décision avec motif), paiement par le syndic avec photo du reçu,
/// soumission / annulation. La création détaillée reste web-first (docs/PARITE_WEB_MOBILE.md).

const _statutsOnglets = ['TOUS', 'A_APPROUVER', 'APPROUVEE', 'PAYEE', 'BROUILLON', 'REJETEE', 'ANNULEE'];

// ── Liste ─────────────────────────────────────────────────────────────────────
class DepensesScreen extends ConsumerStatefulWidget {
  const DepensesScreen({super.key});
  @override
  ConsumerState<DepensesScreen> createState() => _DepensesScreenState();
}

class _DepensesScreenState extends ConsumerState<DepensesScreen> {
  String _onglet = 'TOUS';

  @override
  Widget build(BuildContext context) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final statut = _onglet == 'TOUS' ? null : _onglet;
    final depenses = ref.watch(depensesProvider(statut));
    final rapport = ref.watch(budgetVsRealiseProvider).valueOrNull;

    return SuPage(
      title: d.depenses.titre,
      subtitle: d.depenses.subtitle,
      onRefresh: () async {
        ref.invalidate(depensesProvider);
        ref.invalidate(budgetVsRealiseProvider);
      },
      children: [
        if (rapport != null) ...[
          if (rapport.seuilNonConfigure && ctx.isGestion) SuBanner(tone: BannerTone.legal, title: d.depenses.seuilNonConfigure, body: d.depenses.seuilNonConfigureCorps),
          if (rapport.seuilNonConfigure && ctx.isGestion) const SizedBox(height: 12),
          TwoCols([
            StatTile(label: d.depenses.aApprouver, value: '${rapport.nbAApprouver}', icon: Icons.pending_actions_rounded, tone: rapport.nbAApprouver > 0 ? Tone.warn : Tone.sage, onTap: () => setState(() => _onglet = 'A_APPROUVER')),
            StatTile(label: d.depenses.engage, value: formatMAD(rapport.totaux.engage, l), icon: Icons.hourglass_bottom_rounded, tone: Tone.tosca, hint: d.depenses.engageAide),
            StatTile(label: d.depenses.realise, value: formatMAD(rapport.totaux.realise, l), icon: Icons.savings_rounded, tone: rapport.totaux.depassement ? Tone.danger : Tone.sage, hint: rapport.budgetMontantTotal != null ? '${d.depenses.prevu} : ${formatMAD(rapport.budgetMontantTotal, l)}' : d.depenses.aucunBudgetActif),
            StatTile(label: d.depenses.reserveSolde, value: formatMAD(rapport.reserveSolde, l), icon: Icons.account_balance_rounded, tone: Tone.lilac),
          ]),
          const SizedBox(height: 12),
        ],
        FilterChips<String>(value: _onglet, options: _statutsOnglets, labelOf: (s) => s == 'TOUS' ? d.depenses.tous : (d.enumsDepenses.statutDepense[s] ?? s), onChanged: (v) => setState(() => _onglet = v)),
        const SizedBox(height: 12),
        AsyncView(
          depenses,
          onRetry: () => ref.invalidate(depensesProvider(statut)),
          data: (rows) => rows.isEmpty
              ? EmptyState(title: statut == null ? d.depenses.aucune : d.depenses.aucuneFiltre, hint: statut == null && ctx.isGestion ? d.depenses.aucuneAide : null, icon: Icons.receipt_long_rounded)
              : CardList([for (final x in rows) DepenseRow(x)]),
        ),
      ],
    );
  }
}

class DepenseRow extends StatelessWidget {
  const DepenseRow(this.x, {super.key});
  final Depense x;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final sous = [formatDate(x.dateDepense, l), d.enumsDepenses.categorieDepense[x.categorie] ?? x.categorie, if (x.prestataire != null) x.prestataire!.nom].join(' · ');
    return ListRow(
      leading: IconCircle(Icons.receipt_long_rounded, tone: x.source == 'FONDS_RESERVE' ? Tone.lilac : Tone.sage, size: 40),
      title: x.libelle,
      subtitle: sous,
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
        MoneyText(formatMAD(x.montantTtc, l)),
        const SizedBox(height: 4),
        StatusBadge(d.enumsDepenses.statutDepense[x.statut] ?? x.statut, variant: depenseVariant[x.statut] ?? BadgeVariant.neutral, small: true),
      ]),
      onTap: () => context.push('/depenses/${x.id}'),
    );
  }
}

// ── Détail ────────────────────────────────────────────────────────────────────
class DepenseDetailScreen extends ConsumerWidget {
  const DepenseDetailScreen({super.key, required this.id});
  final String id;

  void _refresh(WidgetRef ref) {
    ref.invalidate(depenseProvider(id));
    ref.invalidate(depenseDocumentsProvider(id));
    ref.invalidate(depensesProvider);
    ref.invalidate(budgetVsRealiseProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final dep = ref.watch(depenseProvider(id));
    final docs = ref.watch(depenseDocumentsProvider(id)).valueOrNull;

    return SuPage(
      title: dep.valueOrNull?.libelle ?? d.depenses.titre,
      subtitle: dep.valueOrNull == null ? null : d.enumsDepenses.categorieDepense[dep.valueOrNull!.categorie],
      onRefresh: () async => _refresh(ref),
      children: [
        AsyncView(dep, onRetry: () => ref.invalidate(depenseProvider(id)), data: (x) {
          final niveauConseil = x.niveauApprobationRequis == 'CONSEIL';
          final peutDecider = x.statut == 'A_APPROUVER' && ctx.approuveDepenses && (!niveauConseil || ctx.isConseil || ctx.isSuperAdmin);
          final peutPayer = x.statut == 'APPROUVEE' && ctx.gereDepenses;
          final peutSoumettre = x.modifiable && ctx.gereDepenses;
          final peutAnnuler = !x.payee && x.statut != 'ANNULEE' && ctx.gereDepenses;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SuCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    StatusBadge(d.enumsDepenses.statutDepense[x.statut] ?? x.statut, variant: depenseVariant[x.statut] ?? BadgeVariant.neutral),
                    StatusBadge(d.enumsDepenses.sourceFinancement[x.source] ?? x.source, variant: x.source == 'FONDS_RESERVE' ? BadgeVariant.info : BadgeVariant.outline),
                    if (x.budgetPoste != null) StatusBadge(x.budgetPoste!.nom, variant: BadgeVariant.neutral),
                  ]),
                  const SizedBox(height: 14),
                  Text(d.depenses.montantTtc, style: t.labelMedium),
                  MoneyText(formatMAD(x.montantTtc, l), style: t.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                  if (x.montantHt != null) ...[
                    const SizedBox(height: 8),
                    KeyValueRow(d.depenses.montantHt, formatMAD(x.montantHt, l)),
                    KeyValueRow(d.depenses.tva, formatMAD(x.tva, l)),
                  ],
                  KeyValueRow(d.depenses.date, formatDate(x.dateDepense, l)),
                  if (x.description != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(x.description!, style: t.bodyMedium?.copyWith(color: SuColors.ink))),
                ]),
              ),
              if (x.statut == 'A_APPROUVER') ...[
                const SizedBox(height: 12),
                SuBanner(tone: x.seuilNonConfigure ? BannerTone.legal : BannerTone.info, title: '${d.depenses.niveau} : ${d.enumsDepenses.niveauApprobation[x.niveauApprobationRequis ?? 'SYNDIC'] ?? ''}', body: x.seuilNonConfigure ? d.depenses.seuilNonConfigureCorps : d.depenses.soumettreCorps),
              ],
              if (x.statut == 'REJETEE' && x.motifRejet != null) ...[
                const SizedBox(height: 12),
                SuBanner(tone: BannerTone.danger, title: d.depenses.motifRejet, body: x.motifRejet!),
              ],
              // Actions
              if (peutDecider || peutPayer || peutSoumettre || peutAnnuler) ...[
                const SizedBox(height: 14),
                if (peutSoumettre) SubmitButton(label: d.depenses.soumettre, icon: Icons.send_rounded, onPressed: () => _soumettre(context, ref, x)),
                if (peutDecider) ...[
                  SubmitButton(label: d.depenses.approuver, icon: Icons.check_circle_rounded, onPressed: () => _decider(context, ref, x, approuver: true)),
                  const SizedBox(height: 8),
                  SubmitButton(label: d.depenses.rejeter, icon: Icons.cancel_rounded, danger: true, secondary: true, onPressed: () => _decider(context, ref, x, approuver: false)),
                ],
                if (peutPayer) SubmitButton(label: d.depenses.payer, icon: Icons.photo_camera_rounded, onPressed: () => _payer(context, ref, x)),
                if (peutAnnuler) ...[
                  const SizedBox(height: 8),
                  TextButton(onPressed: () => _annuler(context, ref, x), child: Text(d.depenses.annuler, style: const TextStyle(color: SuColors.danger))),
                ],
              ],
              // Paiement
              if (x.payee) ...[
                SectionHeader(d.depenses.paiement),
                SuCard(
                  child: Column(children: [
                    KeyValueRow(d.depenses.payeLe, formatDate(x.payeLe, l)),
                    KeyValueRow(d.depenses.methode, d.enumsDepenses.methodePaiementDepense[x.methodePaiement ?? ''] ?? '—'),
                    KeyValueRow(d.depenses.reference, x.referencePaiement ?? '—', mono: true),
                    if (x.mouvementReserve != null) KeyValueRow(d.depenses.mouvementReserve, formatMAD(x.mouvementReserve, l), mono: true),
                    if (docs?.justificatif != null)
                      Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: () => ouvrirVisionneuse(context, titre: docs!.justificatif!.nom, url: docs.justificatif!.url), icon: const Icon(Icons.receipt_rounded, size: 18), label: Text(d.depenses.voirPreuve))),
                  ]),
                ),
              ],
              // Fournisseur / liens
              SectionHeader(d.depenses.prestataire),
              SuCard(
                child: Column(children: [
                  KeyValueRow(d.depenses.prestataire, x.prestataire?.nom ?? d.depenses.aucunPrestataire),
                  if (x.incident != null)
                    ListRow(padding: EdgeInsets.zero, title: d.depenses.incidentLie, subtitle: x.incident!.nom, chevron: true, onTap: () => context.push('/incidents/${x.incident!.id}')),
                  KeyValueRow(d.depenses.creePar, x.creePar?.nom ?? '—'),
                  if (x.approuvePar != null) KeyValueRow(d.depenses.approuvePar, x.approuvePar!.nom),
                ]),
              ),
              // Factures
              SectionHeader(d.depenses.factures),
              if (x.factures.isEmpty)
                SuCard(child: Text(d.depenses.aucuneFacture, style: t.bodySmall))
              else
                CardList([
                  for (int k = 0; k < x.factures.length; k++)
                    ListRow(
                      leading: const IconCircle(Icons.picture_as_pdf_rounded, tone: Tone.sand, size: 40),
                      title: x.factures[k].numero ?? d.depenses.facture,
                      subtitle: '${formatDate(x.factures[k].dateFacture, l)}${x.factures[k].dateEcheance != null ? ' · ${d.depenses.dateEcheance} ${formatDate(x.factures[k].dateEcheance, l)}' : ''}',
                      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                        MoneyText(formatMAD(x.factures[k].montantTtc, l)),
                        const SizedBox(height: 4),
                        StatusBadge(d.enumsDepenses.statutFacture[x.factures[k].statut] ?? x.factures[k].statut, variant: factureVariant[x.factures[k].statut] ?? BadgeVariant.neutral, small: true),
                      ]),
                      onTap: docs != null && k < docs.factures.length ? () => ouvrirVisionneuse(context, titre: docs.factures[k].nom, url: docs.factures[k].url) : null,
                    ),
                ]),
              // Journal append-only
              SectionHeader(d.depenses.journal, subtitle: d.depenses.journalAide),
              if (x.logs.isEmpty)
                SuCard(child: Text(d.depenses.journalVide, style: t.bodySmall))
              else
                SuCard(
                  child: Column(children: [
                    for (int k = 0; k < x.logs.length; k++) _LogItem(log: x.logs[k], last: k == x.logs.length - 1),
                  ]),
                ),
            ],
          );
        }),
      ],
    );
  }

  Future<void> _soumettre(BuildContext context, WidgetRef ref, Depense x) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.depenses.soumettreTitre, body: d.depenses.soumettreCorps, confirmLabel: d.depenses.soumettre);
    if (!ok || !context.mounted) return;
    final r = await ref.read(apiClientProvider).post<Depense>('/depenses/${x.id}/soumettre', body: const {}, idempotent: true, parse: (j) => Depense.fromJson(asMap(j)));
    if (!context.mounted) return;
    switch (r) {
      case ApiOk<Depense>():
        _refresh(ref);
        showToast(context, d.depenses.soumise);
      case ApiFail<Depense>():
        showToast(context, r.error.message, error: true);
    }
  }

  Future<void> _annuler(BuildContext context, WidgetRef ref, Depense x) async {
    final d = context.dict;
    final motif = await demanderMotifDepense(context, title: d.depenses.annulerTitre, body: d.depenses.annulerCorps, label: d.depenses.annulerMotif, submit: d.depenses.annuler, danger: true);
    if (motif == null || !context.mounted) return;
    final r = await ref.read(apiClientProvider).post<Depense>('/depenses/${x.id}/annuler', body: {'motif': motif.isEmpty ? null : motif}, idempotent: true, parse: (j) => Depense.fromJson(asMap(j)));
    if (!context.mounted) return;
    switch (r) {
      case ApiOk<Depense>():
        _refresh(ref);
        showToast(context, d.depenses.annulee);
      case ApiFail<Depense>():
        showToast(context, r.error.message, error: true);
    }
  }

  Future<void> _decider(BuildContext context, WidgetRef ref, Depense x, {required bool approuver}) async {
    await showFormSheet<void>(context, title: approuver ? context.dict.depenses.approuverTitre : context.dict.depenses.rejeterTitre, builder: (_) => _DecisionForm(depense: x, approuver: approuver, onDone: () => _refresh(ref)));
  }

  Future<void> _payer(BuildContext context, WidgetRef ref, Depense x) async {
    await showFormSheet<void>(context, title: context.dict.depenses.payerTitre, builder: (_) => _PaiementForm(depense: x, onDone: () => _refresh(ref)));
  }
}

class _LogItem extends StatelessWidget {
  const _LogItem({required this.log, required this.last});
  final DepenseLog log;
  final bool last;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final ok = log.type == 'PAYEE' || log.type == 'APPROUVEE';
    final ko = log.type == 'REJETEE' || log.type == 'ANNULEE' || log.type == 'FACTURE_CONTESTEE';
    final couleur = ok ? SuColors.ok : ko ? SuColors.danger : SuColors.action;
    final motif = log.details['motif'];
    final methode = log.details['methode'];
    final reference = log.details['reference'];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(children: [
          Container(width: 10, height: 10, margin: const EdgeInsets.only(top: 5), decoration: BoxDecoration(color: couleur, shape: BoxShape.circle)),
          if (!last) Container(width: 2, height: 36, color: SuColors.hairline),
        ]),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(d.enumsDepenses.typeLog[log.type] ?? log.type, style: t.titleSmall),
              if (motif is String && motif.isNotEmpty) Text(motif, style: t.bodySmall?.copyWith(color: SuColors.ink)),
              if (methode is String) Text('${d.enumsDepenses.methodePaiementDepense[methode] ?? methode}${reference is String && reference.isNotEmpty ? ' · $reference' : ''}', style: t.bodySmall?.copyWith(color: SuColors.ink), textDirection: TextDirection.ltr),
              Text('${log.acteurNom ?? '—'} · ${formatDateHeure(log.horodatage, context.locale)}', style: t.labelSmall),
            ]),
          ),
        ),
      ],
    );
  }
}

/// Approbation / rejet (conseil au-dessus du seuil, syndic en dessous) — écriture probante :
/// Idempotency-Key stable par formulaire (« Réessayer » ne crée jamais une seconde décision).
class _DecisionForm extends ConsumerStatefulWidget {
  const _DecisionForm({required this.depense, required this.approuver, required this.onDone});
  final Depense depense;
  final bool approuver;
  final VoidCallback onDone;
  @override
  ConsumerState<_DecisionForm> createState() => _DecisionFormState();
}

class _DecisionFormState extends ConsumerState<_DecisionForm> {
  final _key = const Uuid().v4();
  final _motif = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final md = context.mdict;
    final l = context.locale;
    final x = widget.depense;
    final motifRequis = !widget.approuver;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(x.libelle, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        MoneyText(formatMAD(x.montantTtc, l), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Text(widget.approuver ? fill(d.depenses.approuverCorps, {'libelle': x.libelle, 'montant': formatMAD(x.montantTtc, l)}) : d.depenses.rejeterMotifAide, style: Theme.of(context).textTheme.bodySmall),
        if (motifRequis) ...[
          const SizedBox(height: 14),
          SuField(label: d.depenses.rejeterMotif, controller: _motif, maxLines: 3, required: true, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'motif')),
        ],
        const SizedBox(height: 10),
        Text(md.retryHint, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 14),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: widget.approuver ? d.depenses.approuver : d.depenses.rejeter,
          loading: _loading,
          danger: !widget.approuver,
          onPressed: motifRequis && _motif.text.trim().isEmpty
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final api = ref.read(apiClientProvider);
                  final r = widget.approuver
                      ? await api.post<Depense>('/depenses/${x.id}/approuver', body: const {}, idempotencyKey: _key, parse: (j) => Depense.fromJson(asMap(j)))
                      : await api.post<Depense>('/depenses/${x.id}/rejeter', body: {'motif': _motif.text.trim()}, idempotencyKey: _key, parse: (j) => Depense.fromJson(asMap(j)));
                  if (!mounted) return;
                  switch (r) {
                    case ApiOk<Depense>():
                      widget.onDone();
                      Navigator.pop(context);
                      showToast(context, widget.approuver ? d.depenses.approuvee : d.depenses.rejetee);
                    case ApiFail<Depense>():
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

/// Paiement par le syndic : méthode, référence (rapprochement bancaire manuel), date, photo du
/// reçu (caméra / galerie / PDF) téléversée via URL signée puis attachée à la dépense.
class _PaiementForm extends ConsumerStatefulWidget {
  const _PaiementForm({required this.depense, required this.onDone});
  final Depense depense;
  final VoidCallback onDone;
  @override
  ConsumerState<_PaiementForm> createState() => _PaiementFormState();
}

class _PaiementFormState extends ConsumerState<_PaiementForm> {
  final _key = const Uuid().v4();
  String _methode = 'VIREMENT';
  final _reference = TextEditingController();
  DateTime _date = DateTime.now();
  PieceLocale? _piece;
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final x = widget.depense;
    final referenceRequise = _methode != 'ESPECES';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('${x.libelle} · ${formatMAD(x.montantTtc, l)}', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(d.depenses.payerCorps, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 14),
        Segmented<String>(value: _methode, options: const ['VIREMENT', 'CHEQUE', 'ESPECES'], labelOf: (v) => d.enumsDepenses.methodePaiementDepense[v] ?? v, onChanged: (v) => setState(() => _methode = v)),
        const SizedBox(height: 14),
        SuField(label: d.depenses.reference, controller: _reference, help: d.depenses.referenceAide, required: referenceRequise, optionalLabel: referenceRequise ? null : d.common.optional, mono: true, textDirection: TextDirection.ltr, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'reference')),
        const SizedBox(height: 10),
        ListRow(
          padding: EdgeInsets.zero,
          leading: const IconCircle(Icons.event_rounded, tone: Tone.neutral, size: 36),
          title: d.depenses.datePaiement,
          subtitle: formatDate(jourIso(_date), l),
          chevron: true,
          onTap: () async {
            final p = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)));
            if (p != null) setState(() => _date = p);
          },
        ),
        const SizedBox(height: 10),
        Text(d.depenses.justificatif, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 4),
        Text(d.depenses.justificatifAide, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (_piece != null)
            Chip(avatar: Icon(_piece!.estImage ? Icons.image_rounded : Icons.picture_as_pdf_rounded, size: 16, color: SuColors.action), label: Text(_piece!.nom, overflow: TextOverflow.ellipsis), onDeleted: () => setState(() => _piece = null))
          else
            ActionChip(
              avatar: const Icon(Icons.add_a_photo_rounded, size: 16, color: SuColors.action),
              label: Text(d.depenses.prendrePhoto),
              onPressed: () async {
                final p = await choisirPiece(context);
                if (p != null) setState(() => _piece = p);
              },
            ),
        ]),
        const SizedBox(height: 14),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.depenses.payer,
          loading: _loading,
          icon: Icons.check_rounded,
          onPressed: referenceRequise && _reference.text.trim().isEmpty
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final api = ref.read(apiClientProvider);
                  Map<String, String>? justificatif;
                  if (_piece != null) {
                    justificatif = await televerserPieceDepense(api, _piece!);
                    if (justificatif == null) {
                      if (!mounted) return;
                      setState(() => _loading = false);
                      showToast(context, context.mdict.viewerError, error: true);
                      return;
                    }
                  }
                  final r = await api.post<Depense>('/depenses/${x.id}/payer', body: {'methode': _methode, 'reference': _reference.text.trim().isEmpty ? null : _reference.text.trim(), 'date_paiement': jourIso(_date), 'justificatif': justificatif}, idempotencyKey: _key, parse: (j) => Depense.fromJson(asMap(j)));
                  if (!mounted) return;
                  switch (r) {
                    case ApiOk<Depense>():
                      widget.onDone();
                      Navigator.pop(context);
                      showToast(context, x.source == 'FONDS_RESERVE' ? '${d.depenses.payee} ${d.depenses.payeeReserve}' : d.depenses.payee);
                    case ApiFail<Depense>():
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

/// URL signée → PUT direct → `{ storage_path, nom }` prêt pour l'API ; null si échec.
Future<Map<String, String>?> televerserPieceDepense(ApiClient api, PieceLocale p) async {
  final prep = await api.post<Map<String, dynamic>>('/depenses/upload-url', body: {'nom_fichier': p.nom, 'content_type': p.contentType}, parse: asMap);
  if (prep is! ApiOk<Map<String, dynamic>>) return null;
  final ok = await api.uploadSigned(prep.data['upload_url'] as String, await File(p.chemin).readAsBytes(), p.contentType);
  if (!ok) return null;
  return {'storage_path': prep.data['storage_path'] as String, 'nom': p.nom};
}

/// Feuille « motif » générique (annulation) — renvoie la saisie (vide autorisé si non requis).
Future<String?> demanderMotifDepense(BuildContext context, {required String title, required String body, required String label, required String submit, bool required = false, bool danger = false}) {
  return showFormSheet<String>(context, title: title, builder: (_) => _MotifForm(body: body, label: label, submit: submit, required: required, danger: danger));
}

class _MotifForm extends StatefulWidget {
  const _MotifForm({required this.body, required this.label, required this.submit, required this.required, required this.danger});
  final String body, label, submit;
  final bool required, danger;
  @override
  State<_MotifForm> createState() => _MotifFormState();
}

class _MotifFormState extends State<_MotifForm> {
  final _c = TextEditingController();
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.body, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          SuField(label: widget.label, controller: _c, maxLines: 3, required: widget.required, optionalLabel: widget.required ? null : context.dict.common.optional, onChanged: (_) => setState(() {})),
          const SizedBox(height: 14),
          SubmitButton(label: widget.submit, danger: widget.danger, onPressed: widget.required && _c.text.trim().isEmpty ? null : () => Navigator.pop(context, _c.text.trim())),
        ],
      );
}

// ── Évaluation du prestataire (incident RESOLU/FERME) ─────────────────────────
/// Note 1–5 + commentaire — créateur du ticket ou syndic, une seule fois.
class EvaluationPrestataireForm extends ConsumerStatefulWidget {
  const EvaluationPrestataireForm({super.key, required this.incident, required this.onDone});
  final Incident incident;
  final VoidCallback onDone;
  @override
  ConsumerState<EvaluationPrestataireForm> createState() => _EvaluationPrestataireFormState();
}

class _EvaluationPrestataireFormState extends ConsumerState<EvaluationPrestataireForm> {
  int _note = 0;
  final _commentaire = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(d.depenses.evaluerCorps, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 14),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (int n = 1; n <= 5; n++)
                IconButton(
                  iconSize: 36,
                  tooltip: '$n/5',
                  onPressed: () => setState(() => _note = n),
                  icon: Icon(n <= _note ? Icons.star_rounded : Icons.star_border_rounded, color: n <= _note ? SuColors.warn : SuColors.hairlineStrong),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        SuField(label: d.depenses.commentaire, controller: _commentaire, maxLines: 3, optionalLabel: d.common.optional, error: fieldError(_fail, 'commentaire')),
        const SizedBox(height: 14),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.send,
          loading: _loading,
          onPressed: _note == 0
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final r = await ref.read(apiClientProvider).post<Map<String, dynamic>>('/incidents/${widget.incident.id}/evaluation', body: {'note': _note, 'commentaire': _commentaire.text.trim().isEmpty ? null : _commentaire.text.trim()}, parse: asMap);
                  if (!mounted) return;
                  switch (r) {
                    case ApiOk<Map<String, dynamic>>():
                      widget.onDone();
                      Navigator.pop(context);
                      showToast(context, d.depenses.evalue);
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
