import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../documents/document_viewer_screen.dart';

/// M18 Rapports (Doc A §8, §6, §3.5) — mobile :
///  - `TransparenceScreen` : « où va mon argent » pour tout membre (parité web totale) — agrégats
///    de niveau copropriété, jamais un lot ; factures dans la visionneuse si le syndic l'autorise ;
///    rapports de gestion publiés.
///  - `RapportsScreen` : tableau de bord de gestion en LECTURE (syndic / conseil) + rapports annuels
///    avec PDF FR / AR dans la visionneuse. Génération, soumission à l'AG, grand livre et exports
///    restent web-first (docs/PARITE_WEB_MOBILE.md).
///  - `ReleveButton` : relevé de charges PDF d'un lot (« état daté »), partage depuis la visionneuse.

double _ratio(String? part, String? total) {
  final p = double.tryParse(part ?? '') ?? 0;
  final t = double.tryParse(total ?? '') ?? 0;
  if (t <= 0) return 0;
  return (p / t).clamp(0.0, 1.0);
}

class _Ligne extends StatelessWidget {
  const _Ligne({required this.label, required this.valeur, this.ratio, this.color, this.hint});
  final String label, valeur;
  final double? ratio;
  final Color? color;
  final String? hint;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(label, style: t.bodyMedium?.copyWith(color: SuColors.body), maxLines: 1, overflow: TextOverflow.ellipsis)),
          const SizedBox(width: 8),
          MoneyText(valeur, style: t.titleSmall),
        ]),
        if (hint != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(hint!, style: t.labelSmall)),
        if (ratio != null) Padding(padding: const EdgeInsets.only(top: 6), child: Gauge(ratio!, height: 6, color: color)),
      ]),
    );
  }
}

/// Barres jumelles encaissements / décaissements sur 12 mois + solde (ligne). RTL : l'axe du temps s'inverse.
class _TresoreriePainter extends CustomPainter {
  _TresoreriePainter(this.points, this.rtl);
  final List<PointTresorerie> points;
  final bool rtl;
  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final ordre = rtl ? points.reversed.toList() : points;
    double v(String s) => double.tryParse(s) ?? 0;
    final maxBar = ordre.fold<double>(1, (m, p) => [m, v(p.entrees), v(p.sorties)].reduce((a, b) => a > b ? a : b));
    final soldes = ordre.map((p) => v(p.solde)).toList();
    final minS = [0.0, ...soldes].reduce((a, b) => a < b ? a : b);
    final maxS = [1.0, ...soldes].reduce((a, b) => a > b ? a : b);
    final slot = size.width / ordre.length;
    final h = size.height - 4;
    final base = Paint()..color = SuColors.hairlineStrong..strokeWidth = 1;
    canvas.drawLine(Offset(0, size.height - 1), Offset(size.width, size.height - 1), base);
    final pe = Paint()..color = SuColors.sage;
    final ps = Paint()..color = SuColors.sandMid;
    for (var i = 0; i < ordre.length; i++) {
      final x0 = i * slot + slot * 0.18;
      final w = slot * 0.28;
      final he = h * v(ordre[i].entrees) / maxBar;
      final hs = h * v(ordre[i].sorties) / maxBar;
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x0, size.height - 1 - he, w, he), const Radius.circular(2)), pe);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x0 + w + slot * 0.08, size.height - 1 - hs, w, hs), const Radius.circular(2)), ps);
    }
    final ligne = Path();
    for (var i = 0; i < ordre.length; i++) {
      final y = size.height - 1 - h * ((soldes[i] - minS) / ((maxS - minS) == 0 ? 1 : (maxS - minS)));
      final x = i * slot + slot / 2;
      if (i == 0) {
        ligne.moveTo(x, y);
      } else {
        ligne.lineTo(x, y);
      }
    }
    canvas.drawPath(ligne, Paint()..color = SuColors.ink..style = PaintingStyle.stroke..strokeWidth = 1.6..strokeJoin = StrokeJoin.round);
  }
  @override
  bool shouldRepaint(covariant _TresoreriePainter old) => old.points != points || old.rtl != rtl;
}

class _Legende extends StatelessWidget {
  const _Legende(this.color, this.label, {this.ligne = false});
  final Color color;
  final String label;
  final bool ligne;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: ligne ? 14 : 10, height: ligne ? 2 : 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 6),
        Text(label, style: Theme.of(context).textTheme.labelSmall),
      ]);
}

// ── Syndic / conseil : tableau de bord (lecture) + rapports annuels ───────────
class RapportsScreen extends ConsumerWidget {
  const RapportsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final tb = ref.watch(tableauDeBordProvider);
    final rapports = ref.watch(rapportsGestionProvider);
    return SuPage(
      title: d.rapports.titre,
      subtitle: d.rapports.subtitle,
      onRefresh: () async {
        ref.invalidate(tableauDeBordProvider);
        ref.invalidate(rapportsGestionProvider);
      },
      children: [
        SuBanner(tone: BannerTone.info, body: d.rapports.compteCourantAide),
        const SizedBox(height: 12),
        AsyncView(tb, onRetry: () => ref.invalidate(tableauDeBordProvider), data: (x) {
          final negatif = (double.tryParse(x.compteCourant) ?? 0) < 0;
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TwoCols([
              StatTile(label: d.rapports.compteCourant, value: formatMAD(x.compteCourant, l), icon: Icons.account_balance_wallet_rounded, tone: negatif ? Tone.danger : Tone.sage, hint: '${d.rapports.entrees} ${formatMAD(x.totalEntrees, l)}'),
              StatTile(label: d.rapports.reserve, value: x.reserveConfiguree ? formatMAD(x.reserve, l) : '—', icon: Icons.savings_rounded, tone: Tone.lilac, hint: x.reserveConfiguree ? null : d.rapports.reserveAbsente),
              StatTile(label: d.rapports.recouvrement, value: x.tauxRecouvrement != null ? '${x.tauxRecouvrement} %' : '—', icon: Icons.insights_rounded, tone: Tone.tosca, hint: x.encaisse != null ? '${d.rapports.encaisse} ${formatMAD(x.encaisse, l)}' : null),
              StatTile(label: d.rapports.impayes, value: formatMAD(x.impayesTotal, l), icon: Icons.warning_amber_rounded, tone: x.nbLotsEnRetard > 0 ? Tone.warn : Tone.sage, hint: fill(d.rapports.lotsEnRetard, {'n': x.nbLotsEnRetard})),
            ]),
            SectionHeader(d.rapports.douzeMois, subtitle: d.rapports.douzeMoisAide),
            SuCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(height: 140, width: double.infinity, child: CustomPaint(painter: _TresoreriePainter(x.serie, rtl))),
                const SizedBox(height: 6),
                Row(children: [
                  for (final p in (rtl ? x.serie.reversed : x.serie))
                    Expanded(child: Text(formatPeriode(p.mois, l).split(' ').first.substring(0, 3), textAlign: TextAlign.center, style: t.labelSmall?.copyWith(fontSize: 9), maxLines: 1, overflow: TextOverflow.clip)),
                ]),
                const SizedBox(height: 8),
                Wrap(spacing: 14, runSpacing: 4, children: [_Legende(SuColors.sage, d.rapports.entrees), _Legende(SuColors.sandMid, d.rapports.sorties), _Legende(SuColors.ink, d.rapports.solde, ligne: true)]),
              ]),
            ),
            SectionHeader(d.rapports.impayes, subtitle: d.rapports.impayesAide, actionLabel: d.rapports.voirTout, onAction: () => context.push('/finances/appels-de-fonds')),
            SuCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final tr in x.tranches)
                  _Ligne(label: d.enumsRapports.tranche[tr.tranche] ?? tr.tranche, valeur: formatMAD(tr.montant, l), ratio: _ratio(tr.montant, x.impayesTotal), color: tr.tranche == '0_30' ? SuColors.toscaDeep : tr.tranche == '31_90' ? SuColors.warn : SuColors.danger, hint: '${tr.nbLots} ${d.rapports.lots.toLowerCase()} · ${tr.nbLignes} ${d.rapports.lignes.toLowerCase()}'),
                if (x.topLots.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(d.rapports.topLots, style: t.labelMedium),
                  for (final lot in x.topLots)
                    ListRow(padding: const EdgeInsets.symmetric(vertical: 8), title: lot.lotNumero, subtitle: '${lot.retardMaxJours} j${lot.conteste ? ' · ${d.rapports.conteste}' : ''}', trailing: MoneyText(formatMAD(lot.resteDu, l), color: SuColors.danger), onTap: () => context.push('/lots/${lot.lotId}?onglet=finances')),
                ],
              ]),
            ),
            SectionHeader(d.rapports.budget, subtitle: x.budget.budgetId != null ? '${d.rapports.prevu} ${formatMAD(x.budget.budgetMontantTotal, l)} · ${d.rapports.realise} ${formatMAD(x.budget.totaux.realise, l)}' : d.rapports.aucunBudget),
            if (x.budget.postes.isNotEmpty)
              SuCard(child: Column(children: [for (final p in x.budget.postes) _Ligne(label: p.libelle ?? (d.enumsDepenses.categorieDepense[p.categorie] ?? p.categorie), valeur: '${formatMontant(p.realise)} / ${formatMontant(p.montantPrevu)}', ratio: _ratio(p.realise, p.montantPrevu), color: p.depassement ? SuColors.danger : null)])),
            SectionHeader(d.rapports.depenses, subtitle: '${d.rapports.parCategorie} · ${x.exercice}', actionLabel: d.rapports.voirTout, onAction: () => context.push('/depenses')),
            SuCard(child: Column(children: [
              for (final c in x.parCategorie) _Ligne(label: d.enumsDepenses.categorieDepense[c.categorie] ?? c.categorie, valeur: formatMAD(c.montant, l), ratio: _ratio(c.montant, x.depensesTotal), color: SuColors.moss, hint: c.part != null ? '${c.part} % · ${c.nb}' : null),
              if (x.parCategorie.isEmpty) Text(d.rapports.aucuneDepense, style: t.bodySmall),
            ])),
            SectionHeader(d.rapports.incidentsOuverts),
            SuCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 8, runSpacing: 8, children: [for (final e in x.incidentsParUrgence.entries) StatusBadge('${d.enums.urgence[e.key] ?? e.key} · ${e.value}', variant: urgenceVariant[e.key] ?? BadgeVariant.neutral)]),
              const SizedBox(height: 10),
              ListRow(padding: EdgeInsets.zero, title: d.rapports.justificatifsAttente, trailing: MoneyText('${x.justificatifsNb} · ${formatMAD(x.justificatifsMontant, l)}'), onTap: () => context.push('/justificatifs')),
            ])),
          ]);
        }),
        SectionHeader(d.rapports.gestionTitre, subtitle: d.rapports.gestionSubtitle),
        AsyncView(rapports, onRetry: () => ref.invalidate(rapportsGestionProvider), data: (rows) {
          if (rows.isEmpty) return EmptyState(title: d.rapports.aucunRapport, hint: d.rapports.aucunRapportAide, icon: Icons.summarize_rounded);
          return CardList([for (final r in rows) _RapportRow(r)]);
        }),
      ],
    );
  }
}

class _RapportRow extends ConsumerWidget {
  const _RapportRow(this.r);
  final RapportGestion r;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final langue = l.languageCode == 'ar' ? 'ar' : 'fr';
    return ListRow(
      leading: IconCircle(Icons.summarize_rounded, tone: r.statut == 'APPROUVE' ? Tone.ok : r.statut == 'REJETE' ? Tone.danger : Tone.sage, size: 40),
      title: '${d.rapports.exercice} ${r.exercice}',
      subtitle: '${d.rapports.compteCourant} ${formatMAD(r.compteCourantCloture, l)}${r.tauxRecouvrement != null ? ' · ${r.tauxRecouvrement} %' : ''}',
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
        StatusBadge(d.enumsRapports.statutRapport[r.statut] ?? r.statut, variant: rapportVariant[r.statut] ?? BadgeVariant.neutral, small: true),
        const SizedBox(height: 4),
        Text(formatDateCourte(r.genereLe, l), style: Theme.of(context).textTheme.labelSmall),
      ]),
      onTap: () => ouvrirPdfApi(context, ref, endpoint: '/rapports/gestion/${r.id}/pdf', query: {'langue': langue, 'variante': 'complete'}, titre: '${d.rapports.gestionTitre} ${r.exercice}'),
    );
  }
}

// ── Tout membre : « où va mon argent » ────────────────────────────────────────
class TransparenceScreen extends ConsumerStatefulWidget {
  const TransparenceScreen({super.key});
  @override
  ConsumerState<TransparenceScreen> createState() => _TransparenceScreenState();
}

class _TransparenceScreenState extends ConsumerState<TransparenceScreen> {
  late String _exercice = DateTime.now().year.toString();
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final ctx = ref.watch(appContextProvider);
    final vue = ref.watch(transparenceProvider(_exercice));
    final annee = DateTime.now().year;
    final exercices = [for (var i = 0; i < 3; i++) (annee - i).toString()];
    final viewerLabels = (see: d.common.see, close: d.common.close, download: d.common.download);
    return SuPage(
      title: d.rapports.transparenceTitre,
      subtitle: d.rapports.transparenceSubtitle,
      onRefresh: () async => ref.invalidate(transparenceProvider),
      children: [
        Segmented<String>(value: _exercice, options: exercices, labelOf: (x) => x, onChanged: (v) => setState(() => _exercice = v)),
        const SizedBox(height: 12),
        SuBanner(tone: BannerTone.info, body: d.rapports.transparenceAide),
        const SizedBox(height: 12),
        AsyncView(vue, onRetry: () => ref.invalidate(transparenceProvider(_exercice)), data: (x) {
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TwoCols([
              StatTile(label: d.rapports.compteCourant, value: formatMAD(x.compteCourant, l), icon: Icons.account_balance_wallet_rounded, tone: Tone.sage, hint: d.rapports.compteCourantCourt),
              StatTile(label: d.rapports.reserve, value: x.reserveConfiguree ? formatMAD(x.reserve, l) : '—', icon: Icons.savings_rounded, tone: Tone.lilac, hint: x.reserveConfiguree ? null : d.rapports.reserveAbsente),
              StatTile(label: d.rapports.recouvrement, value: x.tauxRecouvrement != null ? '${x.tauxRecouvrement} %' : '—', icon: Icons.insights_rounded, tone: Tone.tosca, hint: '${d.rapports.encaisse} ${formatMAD(x.encaisse, l)}'),
              StatTile(label: d.rapports.impayes, value: formatMAD(x.impayesTotal, l), icon: Icons.warning_amber_rounded, tone: x.nbLotsEnRetard > 0 ? Tone.warn : Tone.sage, hint: fill(d.rapports.lotsEnRetard, {'n': x.nbLotsEnRetard})),
            ]),
            SectionHeader(d.rapports.budget, subtitle: x.budgetActif ? '${d.rapports.prevu} ${formatMAD(x.budgetPrevu, l)} · ${d.rapports.realise} ${formatMAD(x.budgetRealise, l)}${x.budgetPourcentage != null ? ' · ${x.budgetPourcentage} %' : ''}' : d.rapports.aucunBudget),
            if (x.postes.isNotEmpty)
              SuCard(child: Column(children: [for (final p in x.postes) _Ligne(label: p.libelle, valeur: '${formatMontant(p.realise)} / ${formatMontant(p.montantPrevu)}', ratio: _ratio(p.realise, p.montantPrevu), color: p.depassement ? SuColors.danger : null, hint: d.enumsDepenses.categorieDepense[p.categorie])])),
            SectionHeader(d.rapports.parCategorie, subtitle: '${d.rapports.depenses} · ${formatMAD(x.depensesTotal, l)}'),
            SuCard(child: Column(children: [
              for (final c in x.parCategorie) _Ligne(label: d.enumsDepenses.categorieDepense[c.categorie] ?? c.categorie, valeur: formatMAD(c.montant, l), ratio: _ratio(c.montant, x.depensesTotal), color: SuColors.moss, hint: c.part != null ? '${c.part} %' : null),
              if (x.parCategorie.isEmpty) Text(d.rapports.aucuneDepense, style: t.bodySmall),
            ])),
            SectionHeader(d.rapports.depenses, subtitle: x.facturesVisibles ? d.rapports.facturesVisibles : null),
            if (x.depenses.isEmpty)
              SuCard(child: Text(d.rapports.aucuneDepense, style: t.bodySmall))
            else
              CardList([
                for (final dep in x.depenses)
                  ListRow(
                    leading: IconCircle(dep.source == 'FONDS_RESERVE' ? Icons.savings_rounded : Icons.receipt_long_rounded, tone: dep.source == 'FONDS_RESERVE' ? Tone.lilac : Tone.sand, size: 40),
                    title: dep.libelle,
                    subtitle: '${formatDateCourte(dep.date, l)} · ${d.enumsDepenses.categorieDepense[dep.categorie] ?? dep.categorie}${dep.prestataire != null ? ' · ${dep.prestataire}' : ''}',
                    trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                      MoneyText(formatMAD(dep.montantTtc, l)),
                      if (dep.factures.isNotEmpty)
                        TextButton(
                          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                          onPressed: () => ouvrirVisionneuse(context, titre: dep.factures.first.numero ?? dep.libelle, url: dep.factures.first.url),
                          child: Text(d.rapports.voirFacture, style: t.labelSmall?.copyWith(color: SuColors.action)),
                        ),
                    ]),
                  ),
              ]),
            SectionHeader(d.rapports.rapportsSoumis, subtitle: d.rapports.rapportsSoumisAide),
            if (x.rapports.isEmpty)
              SuCard(child: Text(d.rapports.aucunRapportSoumis, style: t.bodySmall))
            else
              CardList([
                for (final r in x.rapports)
                  ListRow(
                    leading: const IconCircle(Icons.summarize_rounded, tone: Tone.ok, size: 40),
                    title: r.nom,
                    subtitle: formatDateCourte(r.date, l),
                    trailing: Text(viewerLabels.see, style: t.labelMedium?.copyWith(color: SuColors.action)),
                    onTap: () => ouvrirFichierApi(context, ref, endpoint: '/documents/${r.documentId}/download-url', titre: r.nom),
                  ),
              ]),
            if (ctx.isGestion) Padding(padding: const EdgeInsets.only(top: 12), child: Text(d.rapports.facturesVisiblesAide, style: t.labelSmall)),
          ]);
        }),
      ],
    );
  }
}

/// Relevé de charges PDF d'un lot (« état daté ») — bouton pour la fiche lot (propriétaire du lot, syndic, conseil).
class ReleveButton extends ConsumerWidget {
  const ReleveButton({super.key, required this.lotId, required this.lotNumero});
  final String lotId, lotNumero;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final langue = context.locale.languageCode == 'ar' ? 'ar' : 'fr';
    final exercice = DateTime.now().year.toString();
    return OutlinedButton.icon(
      onPressed: () => ouvrirPdfApi(context, ref, endpoint: '/finances/lots/$lotId/releve/pdf', query: {'exercice': exercice, 'langue': langue}, titre: '${d.rapports.releve} $lotNumero $exercice'),
      icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
      label: Text(d.rapports.releveTelecharger),
    );
  }
}
