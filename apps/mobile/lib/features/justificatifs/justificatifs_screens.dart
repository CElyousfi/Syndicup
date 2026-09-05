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
import 'dart:io';

/// M17 Justificatifs de paiement (Doc A §3.3/§3.4) — résident : « Payer » (comptes de la
/// copropriété, déclaration avec preuve, mes déclarations) ; syndic / conseil : file de validation
/// et détail (preuve + échéances ouvertes, valider / rejeter) ; gardien : espèces reçues à la loge.
/// Écritures probantes en ligne avec Idempotency-Key stable (finances : jamais dans la file hors-ligne).

Future<Map<String, String>?> _televerserPreuve(ApiClient api, PieceLocale p) async {
  final prep = await api.post<Map<String, dynamic>>('/finances/justificatifs/upload-url', body: {'nom_fichier': p.nom, 'content_type': p.contentType}, parse: asMap);
  if (prep is! ApiOk<Map<String, dynamic>>) return null;
  final ok = await api.uploadSigned(prep.data['upload_url'] as String, await File(p.chemin).readAsBytes(), p.contentType);
  if (!ok) return null;
  return {'storage_path': prep.data['storage_path'] as String, 'nom': p.nom};
}

class JustificatifRow extends StatelessWidget {
  const JustificatifRow(this.x, {super.key});
  final Justificatif x;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    return ListRow(
      leading: IconCircle(x.methode == 'ESPECES' ? Icons.payments_rounded : Icons.receipt_rounded, tone: x.enAttente ? Tone.warn : Tone.sage, size: 40),
      title: '${x.lotNumero ?? d.justificatifs.lot} · ${d.enumsJustificatifs.methode[x.methode] ?? x.methode}',
      subtitle: '${formatDate(x.datePaiementDeclaree, l)}${x.reference != null ? ' · ${x.reference}' : ''}${x.declareParNom != null ? ' · ${x.declareParNom}' : ''}',
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
        MoneyText(formatMAD(x.montant, l)),
        const SizedBox(height: 4),
        StatusBadge(d.enumsJustificatifs.statutJustificatif[x.statut] ?? x.statut, variant: justificatifVariant[x.statut] ?? BadgeVariant.neutral, small: true),
      ]),
      onTap: () => context.push('/justificatifs/${x.id}'),
    );
  }
}

// ── Résident : Payer ──────────────────────────────────────────────────────────
class PayerScreen extends ConsumerWidget {
  const PayerScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final comptes = ref.watch(comptesBancairesProvider).valueOrNull ?? const <CompteBancaire>[];
    final mes = ref.watch(justificatifsProvider(null));
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    return SuPage(
      title: d.justificatifs.payerTitre,
      subtitle: d.justificatifs.payerSubtitle,
      onRefresh: () async {
        ref.invalidate(justificatifsProvider);
        ref.invalidate(comptesBancairesProvider);
        ref.invalidate(lotsProvider);
      },
      children: [
        SectionHeader(d.justificatifs.virement, subtitle: d.justificatifs.virementAide),
        if (comptes.isEmpty)
          SuCard(child: Text(d.justificatifs.aucunCompte, style: t.bodySmall))
        else
          CardList([
            for (final c in comptes) ListRow(leading: const IconCircle(Icons.account_balance_rounded, tone: Tone.tosca, size: 40), title: c.libelle, subtitle: c.banque, trailing: Text(c.ribMasque, style: t.bodyMedium?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]), textDirection: TextDirection.ltr)),
          ]),
        const SizedBox(height: 12),
        SubmitButton(
          label: d.justificatifs.declarer,
          icon: Icons.photo_camera_rounded,
          onPressed: lots.isEmpty ? null : () => showFormSheet<void>(context, title: d.justificatifs.declarerTitre, builder: (_) => DeclarationForm(lots: lots, comptes: comptes, mode: 'declarer', onDone: () => ref.invalidate(justificatifsProvider))),
        ),
        const SizedBox(height: 12),
        SuBanner(tone: BannerTone.info, title: d.justificatifs.especes, body: d.justificatifs.especesAide),
        const SizedBox(height: 8),
        SuBanner(tone: BannerTone.info, title: d.justificatifs.cmi, body: d.justificatifs.cmiBientot),
        SectionHeader(d.justificatifs.mesDeclarations),
        AsyncView(mes, onRetry: () => ref.invalidate(justificatifsProvider(null)), data: (rows) => rows.isEmpty ? EmptyState(title: d.justificatifs.aucuneDeclaration, icon: Icons.receipt_rounded) : CardList([for (final x in rows) JustificatifRow(x)])),
      ],
    );
  }
}

/// Formulaire de déclaration (résident) / de remise d'espèces (gardien, syndic).
class DeclarationForm extends ConsumerStatefulWidget {
  const DeclarationForm({super.key, required this.lots, required this.comptes, required this.mode, required this.onDone});
  final List<Lot> lots;
  final List<CompteBancaire> comptes;
  final String mode; // declarer | especes
  final VoidCallback onDone;
  @override
  ConsumerState<DeclarationForm> createState() => _DeclarationFormState();
}

class _DeclarationFormState extends ConsumerState<DeclarationForm> {
  final _key = const Uuid().v4();
  Lot? _lot;
  String _methode = 'VIREMENT';
  final _montant = TextEditingController();
  final _reference = TextEditingController();
  final _banque = TextEditingController();
  DateTime _date = DateTime.now();
  CompteBancaire? _compte;
  PieceLocale? _piece;
  bool _loading = false;
  ApiFail? _fail;

  @override
  void initState() {
    super.initState();
    _lot = widget.lots.isNotEmpty ? widget.lots.first : null;
    _compte = widget.comptes.isNotEmpty ? widget.comptes.first : null;
    if (widget.mode == 'especes') _methode = 'ESPECES';
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final md = context.mdict;
    final ctx = ref.watch(appContextProvider);
    final j = d.justificatifs;
    final especes = widget.mode == 'especes';
    final preuveRequise = !especes && !ctx.isGestion && !ctx.isGardien;
    final peutEnvoyer = _lot != null && _montant.text.trim().isNotEmpty && (!preuveRequise || _piece != null);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(especes ? j.especesAideGardien : j.declarerAide, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuSelect<Lot>(label: j.lot, value: _lot, options: widget.lots, labelOf: (x) => '${d.enums.typeLot[x.typeLot] ?? x.typeLot} ${x.numero}', onChanged: (v) => setState(() => _lot = v), required: true),
        const SizedBox(height: 10),
        SuField(label: '${j.montant} (${d.common.mad})', controller: _montant, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: montantFormatters, mono: true, textDirection: TextDirection.ltr, required: true, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'montant')),
        const SizedBox(height: 10),
        if (!especes) ...[
          Segmented<String>(value: _methode, options: const ['VIREMENT', 'CHEQUE', 'ESPECES'], labelOf: (v) => d.enumsJustificatifs.methode[v] ?? v, onChanged: (v) => setState(() => _methode = v)),
          const SizedBox(height: 10),
          if (widget.comptes.isNotEmpty) ...[
            SuSelect<CompteBancaire>(label: j.beneficiaire, value: _compte, options: widget.comptes, labelOf: (c) => '${c.libelle} · ${c.ribMasque}', onChanged: (v) => setState(() => _compte = v), required: true),
            const SizedBox(height: 10),
          ],
          if (_methode != 'ESPECES') ...[
            SuField(label: j.banqueEmettrice, controller: _banque, optionalLabel: d.common.optional),
            const SizedBox(height: 10),
            SuField(label: j.reference, controller: _reference, help: j.referenceAide, optionalLabel: d.common.optional, mono: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'reference')),
            const SizedBox(height: 10),
          ],
        ],
        ListRow(
          padding: EdgeInsets.zero,
          leading: const IconCircle(Icons.event_rounded, tone: Tone.neutral, size: 36),
          title: j.datePaiement,
          subtitle: formatDate(jourIso(_date), l),
          chevron: true,
          onTap: () async {
            final p = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)));
            if (p != null) setState(() => _date = p);
          },
        ),
        const SizedBox(height: 10),
        Text(j.preuve + (preuveRequise ? ' *' : ''), style: Theme.of(context).textTheme.labelMedium?.copyWith(color: SuColors.ink)),
        const SizedBox(height: 4),
        Text(j.preuveAide, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          if (_piece != null)
            Chip(avatar: Icon(_piece!.estImage ? Icons.image_rounded : Icons.picture_as_pdf_rounded, size: 16, color: SuColors.action), label: Text(_piece!.nom, overflow: TextOverflow.ellipsis), onDeleted: () => setState(() => _piece = null))
          else
            ActionChip(avatar: const Icon(Icons.add_a_photo_rounded, size: 16, color: SuColors.action), label: Text(j.prendrePhoto), onPressed: () async {
              final p = await choisirPiece(context);
              if (p != null) setState(() => _piece = p);
            }),
        ]),
        const SizedBox(height: 10),
        Text(md.retryHint, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: 12),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: especes ? j.especesSaisir : j.declarer,
          loading: _loading,
          icon: Icons.send_rounded,
          onPressed: !peutEnvoyer
              ? null
              : () async {
                  setState(() {
                    _loading = true;
                    _fail = null;
                  });
                  final api = ref.read(apiClientProvider);
                  Map<String, String>? preuve;
                  if (_piece != null) {
                    preuve = await _televerserPreuve(api, _piece!);
                    if (preuve == null) {
                      if (!mounted) return;
                      setState(() => _loading = false);
                      showToast(context, context.mdict.viewerError, error: true);
                      return;
                    }
                  }
                  final auNom = ctx.isGestion || ctx.isGardien;
                  final r = especes
                      ? await api.post<Map<String, dynamic>>('/finances/paiements/especes', body: {'lot_id': _lot!.id, 'montant': _montant.text.trim(), 'date_paiement': jourIso(_date), 'preuve': preuve}, idempotencyKey: _key, parse: asMap)
                      : await api.post<Map<String, dynamic>>('/finances/justificatifs', body: {
                          auNom ? 'pour_lot_id' : 'lot_id': _lot!.id,
                          'montant': _montant.text.trim(),
                          'methode': _methode,
                          'date_paiement': jourIso(_date),
                          'banque_emettrice': _banque.text.trim().isEmpty ? null : _banque.text.trim(),
                          'beneficiaire': _compte?.libelle ?? (_methode == 'ESPECES' ? j.especes : '—'),
                          'reference': _reference.text.trim().isEmpty ? null : _reference.text.trim(),
                          'preuve': preuve,
                        }, idempotencyKey: _key, parse: asMap);
                  if (!mounted) return;
                  switch (r) {
                    case ApiOk<Map<String, dynamic>>():
                      widget.onDone();
                      Navigator.pop(context);
                      showToast(context, especes ? (r.data['type'] == 'PAIEMENT' ? j.especesPaiement : j.especesSaisie) : j.declare);
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

// ── Syndic / conseil : file de validation ─────────────────────────────────────
class JustificatifsScreen extends ConsumerStatefulWidget {
  const JustificatifsScreen({super.key});
  @override
  ConsumerState<JustificatifsScreen> createState() => _JustificatifsScreenState();
}

class _JustificatifsScreenState extends ConsumerState<JustificatifsScreen> {
  String _onglet = 'EN_ATTENTE';
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final statut = _onglet == 'TOUS' ? null : _onglet;
    final rows = ref.watch(justificatifsProvider(statut));
    return SuPage(
      title: d.justificatifs.titre,
      subtitle: d.justificatifs.subtitle,
      onRefresh: () async => ref.invalidate(justificatifsProvider),
      children: [
        FilterChips<String>(value: _onglet, options: const ['EN_ATTENTE', 'VALIDE', 'REJETE', 'TOUS'], labelOf: (s) => s == 'TOUS' ? d.justificatifs.tous : (d.enumsJustificatifs.statutJustificatif[s] ?? s), onChanged: (v) => setState(() => _onglet = v)),
        const SizedBox(height: 12),
        AsyncView(rows, onRetry: () => ref.invalidate(justificatifsProvider(statut)), data: (xs) => xs.isEmpty ? EmptyState(title: d.justificatifs.aucun, hint: d.justificatifs.aucunAide, icon: Icons.verified_rounded) : CardList([for (final x in xs) JustificatifRow(x)])),
      ],
    );
  }
}

// ── Gardien : espèces reçues ──────────────────────────────────────────────────
class EspecesScreen extends ConsumerWidget {
  const EspecesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final mes = ref.watch(justificatifsProvider(null));
    return SuPage(
      title: d.justificatifs.especesTitre,
      subtitle: d.justificatifs.especesSubtitle,
      onRefresh: () async => ref.invalidate(justificatifsProvider),
      children: [
        SubmitButton(label: d.justificatifs.especesSaisir, icon: Icons.payments_rounded, onPressed: lots.isEmpty ? null : () => showFormSheet<void>(context, title: d.justificatifs.especesSaisir, builder: (_) => DeclarationForm(lots: lots, comptes: const [], mode: 'especes', onDone: () => ref.invalidate(justificatifsProvider)))),
        SectionHeader(d.justificatifs.mesSaisies),
        AsyncView(mes, onRetry: () => ref.invalidate(justificatifsProvider(null)), data: (xs) => xs.isEmpty ? EmptyState(title: d.justificatifs.aucuneDeclaration, icon: Icons.payments_rounded) : CardList([for (final x in xs) JustificatifRow(x)])),
      ],
    );
  }
}

// ── Détail ────────────────────────────────────────────────────────────────────
class JustificatifDetailScreen extends ConsumerWidget {
  const JustificatifDetailScreen({super.key, required this.id});
  final String id;

  void _refresh(WidgetRef ref) {
    ref.invalidate(justificatifProvider(id));
    ref.invalidate(justificatifsProvider);
    ref.invalidate(soldeLotProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final j = d.justificatifs;
    final x = ref.watch(justificatifProvider(id));
    return SuPage(
      title: x.valueOrNull == null ? j.titre : '${x.valueOrNull!.lotNumero ?? ''} · ${formatMAD(x.valueOrNull!.montant, l)}',
      onRefresh: () async => _refresh(ref),
      children: [
        AsyncView(x, onRetry: () => ref.invalidate(justificatifProvider(id)), data: (y) {
          final affectations = (y.details['affectations'] as List?)?.whereType<Map>().toList() ?? const [];
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 6, runSpacing: 6, children: [
                StatusBadge(d.enumsJustificatifs.statutJustificatif[y.statut] ?? y.statut, variant: justificatifVariant[y.statut] ?? BadgeVariant.neutral),
                StatusBadge(d.enumsJustificatifs.methode[y.methode] ?? y.methode, variant: BadgeVariant.outline),
              ]),
              const SizedBox(height: 12),
              KeyValueRow(j.montant, formatMAD(y.montant, l), mono: true),
              KeyValueRow(j.datePaiement, formatDate(y.datePaiementDeclaree, l)),
              if (y.banqueEmettrice != null) KeyValueRow(j.banqueEmettrice, y.banqueEmettrice!),
              KeyValueRow(j.beneficiaire, y.beneficiaire),
              if (y.reference != null) KeyValueRow(j.reference, y.reference!, mono: true),
              KeyValueRow(j.declarePar, y.declareParNom ?? '—'),
              KeyValueRow(j.imputation, y.appelDeFondsLotId != null ? j.imputationCible : j.imputationFifo),
              if (y.traiteLe != null) KeyValueRow(j.traiteLe, '${formatDateHeure(y.traiteLe, l)} · ${y.traiteParNom ?? ''}'),
            ])),
            if (y.statut == 'REJETE' && y.motifRejet != null) ...[const SizedBox(height: 12), SuBanner(tone: BannerTone.danger, title: j.motifRejet, body: y.motifRejet!)],
            const SizedBox(height: 12),
            if (y.preuveUrl != null)
              SubmitButton(label: j.voirPreuve, icon: Icons.receipt_rounded, secondary: true, onPressed: () => ouvrirVisionneuse(context, titre: y.preuveNom ?? j.preuve, url: y.preuveUrl!))
            else
              SuCard(child: Text(j.aucunePreuve, style: t.bodySmall)),
            if (ctx.isGestion && y.enAttente) ...[
              const SizedBox(height: 12),
              SubmitButton(label: j.valider, icon: Icons.check_circle_rounded, onPressed: () => showFormSheet<void>(context, title: j.validerTitre, builder: (_) => _DecisionForm(justificatif: y, valider: true, onDone: () => _refresh(ref)))),
              const SizedBox(height: 8),
              SubmitButton(label: j.rejeter, icon: Icons.cancel_rounded, danger: true, secondary: true, onPressed: () => showFormSheet<void>(context, title: j.rejeterTitre, builder: (_) => _DecisionForm(justificatif: y, valider: false, onDone: () => _refresh(ref)))),
            ],
            if (y.enAttente && y.declareParId == ctx.profil.id && !ctx.isGestion) ...[
              const SizedBox(height: 8),
              TextButton(onPressed: () => _annuler(context, ref, y), child: Text(j.annuler, style: const TextStyle(color: SuColors.danger))),
            ],
            SectionHeader(j.lignesOuvertes),
            if (y.lignesOuvertes.isEmpty)
              SuCard(child: Text(j.aucuneLigneOuverte, style: t.bodySmall))
            else
              CardList([
                for (final li in y.lignesOuvertes)
                  ListRow(
                    leading: IconCircle(Icons.request_quote_rounded, tone: li.appelDeFondsLotId == y.appelDeFondsLotId ? Tone.action : Tone.neutral, size: 36),
                    title: formatPeriode(li.periode, l),
                    subtitle: '${formatDate(li.dateEcheance, l)} · ${d.enums.typeAppel[li.type] ?? li.type}',
                    trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [MoneyText(formatMAD(li.restant, l)), const SizedBox(height: 4), StatusBadge(d.enums.statutLigne[li.statut] ?? li.statut, variant: ligneAppelVariant[li.statut] ?? BadgeVariant.neutral, small: true)]),
                  ),
              ]),
            if (affectations.isNotEmpty) ...[
              SectionHeader(j.affectations),
              SuCard(child: Column(children: [for (final a in affectations) KeyValueRow(a['statut']?.toString() ?? '', formatMAD(a['montant']?.toString(), l), mono: true)])),
            ],
          ]);
        }),
      ],
    );
  }

  Future<void> _annuler(BuildContext context, WidgetRef ref, Justificatif y) async {
    final d = context.dict;
    final ok = await confirmDialog(context, title: d.justificatifs.annuler, body: d.common.irreversible, confirmLabel: d.justificatifs.annuler, danger: true);
    if (!ok || !context.mounted) return;
    final r = await ref.read(apiClientProvider).post<Justificatif>('/finances/justificatifs/${y.id}/annuler', body: const {}, idempotent: true, parse: (j) => Justificatif.fromJson(asMap(j)));
    if (!context.mounted) return;
    switch (r) {
      case ApiOk<Justificatif>():
        _refresh(ref);
        showToast(context, d.justificatifs.annule);
      case ApiFail<Justificatif>():
        showToast(context, r.error.message, error: true);
    }
  }
}

class _DecisionForm extends ConsumerStatefulWidget {
  const _DecisionForm({required this.justificatif, required this.valider, required this.onDone});
  final Justificatif justificatif;
  final bool valider;
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
    final j = d.justificatifs;
    final l = context.locale;
    final y = widget.justificatif;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${y.lotNumero ?? ''} · ${formatMAD(y.montant, l)}', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      Text(widget.valider ? j.validerCorps : j.rejeterMotifAide, style: Theme.of(context).textTheme.bodySmall),
      if (!widget.valider) ...[const SizedBox(height: 12), SuField(label: j.rejeterMotif, controller: _motif, maxLines: 3, required: true, onChanged: (_) => setState(() {}), error: fieldError(_fail, 'motif'))],
      const SizedBox(height: 10),
      Text(context.mdict.retryHint, style: Theme.of(context).textTheme.labelSmall),
      const SizedBox(height: 12),
      FormError(_fail),
      if (_fail != null) const SizedBox(height: 12),
      SubmitButton(
        label: widget.valider ? j.valider : j.rejeter,
        loading: _loading,
        danger: !widget.valider,
        onPressed: !widget.valider && _motif.text.trim().isEmpty
            ? null
            : () async {
                setState(() {
                  _loading = true;
                  _fail = null;
                });
                final api = ref.read(apiClientProvider);
                final r = widget.valider
                    ? await api.post<Map<String, dynamic>>('/finances/justificatifs/${y.id}/valider', body: const {}, idempotencyKey: _key, parse: asMap)
                    : await api.post<Map<String, dynamic>>('/finances/justificatifs/${y.id}/rejeter', body: {'motif': _motif.text.trim()}, idempotencyKey: _key, parse: asMap);
                if (!mounted) return;
                switch (r) {
                  case ApiOk<Map<String, dynamic>>():
                    widget.onDone();
                    Navigator.pop(context);
                    showToast(context, widget.valider ? j.valide : j.rejete);
                  case ApiFail<Map<String, dynamic>>():
                    setState(() {
                      _loading = false;
                      _fail = r;
                    });
                }
              },
      ),
    ]);
  }
}
