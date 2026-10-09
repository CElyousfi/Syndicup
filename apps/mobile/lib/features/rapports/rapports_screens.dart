import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/feel/feel.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/motion.dart';
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

/// Fin de ligne Wise (transactions) : montant gras aligné en fin, ligne secondaire dessous.
class _MontantFin extends StatelessWidget {
  const _MontantFin(this.montant, {this.secondaire, this.color, this.upIsGood = true});
  /// Montant BRUT de l'API (formaté par AnimatedAmount, comme formatMAD).
  final String? montant;
  final Widget? secondaire;
  final Color? color;
  final bool upIsGood;
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedAmount(montant, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: color), textDirection: TextDirection.ltr, maxLines: null, upIsGood: upIsGood),
          if (secondaire != null) ...[const SizedBox(height: 2), secondaire!],
        ],
      );
}

/// Section secondaire vide : ligne ardoise compacte (pas de carte).
Widget _vide(BuildContext context, String s) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(s, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: SuColors.soft)));

class _Ligne extends StatelessWidget {
  const _Ligne({required this.label, this.valeur = '', this.montant, this.upIsGood = true, this.ratio, this.color, this.hint});
  final String label, valeur;
  /// Montant BRUT de l'API : affiché par AnimatedAmount (prioritaire sur [valeur]).
  final String? montant;
  final bool upIsGood;
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
          if (montant != null) AnimatedAmount(montant, style: t.titleSmall, textDirection: TextDirection.ltr, maxLines: null, upIsGood: upIsGood) else MoneyText(valeur, style: t.titleSmall),
        ]),
        if (hint != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(hint!, style: t.labelSmall)),
        if (ratio != null) Padding(padding: const EdgeInsets.only(top: 6), child: Gauge(ratio!, height: 6, color: color)),
      ]),
    );
  }
}

/// Géométrie normalisée d'un point du graphique (ratios 0..1 de la hauteur utile — des
/// grandeurs de DESSIN, jamais de l'argent : calculées une fois depuis la série de l'API).
class _Geo {
  const _Geo(this.e, this.s, this.y);
  final List<double> e, s, y;

  /// Ratios dans l'ordre d'affichage (RTL : l'axe du temps s'inverse).
  factory _Geo.of(List<PointTresorerie> points, bool rtl) {
    final ordre = rtl ? points.reversed.toList() : points;
    double v(String s) => double.tryParse(s) ?? 0;
    final maxBar = ordre.fold<double>(1, (m, p) => [m, v(p.entrees), v(p.sorties)].reduce((a, b) => a > b ? a : b));
    final soldes = ordre.map((p) => v(p.solde)).toList();
    final minS = [0.0, ...soldes].reduce((a, b) => a < b ? a : b);
    final maxS = [1.0, ...soldes].reduce((a, b) => a > b ? a : b);
    final range = (maxS - minS) == 0 ? 1 : (maxS - minS);
    return _Geo(
      [for (final p in ordre) v(p.entrees) / maxBar],
      [for (final p in ordre) v(p.sorties) / maxBar],
      [for (final x in soldes) (x - minS) / range],
    );
  }

  /// Barres à zéro (montée depuis la ligne de base), ligne déjà à sa place (elle se trace).
  _Geo grounded() => _Geo([for (final _ in e) 0.0], [for (final _ in s) 0.0], y);

  int get length => e.length;

  /// Interpolation point à point ; une série plus courte part de la ligne de base.
  static _Geo lerp(_Geo a, _Geo b, double t) {
    double at(List<double> l, int i, double fallback) => i < l.length ? l[i] : fallback;
    return _Geo(
      [for (var i = 0; i < b.length; i++) at(a.e, i, 0) + (b.e[i] - at(a.e, i, 0)) * t],
      [for (var i = 0; i < b.length; i++) at(a.s, i, 0) + (b.s[i] - at(a.s, i, 0)) * t],
      [for (var i = 0; i < b.length; i++) at(a.y, i, b.y[i]) + (b.y[i] - at(a.y, i, b.y[i])) * t],
    );
  }
}

/// Graphique de trésorerie vivant : au premier affichage les barres poussent depuis la ligne de
/// base et la ligne de solde se trace ; quand l'exercice / les données changent, chaque barre et
/// chaque point GLISSENT de l'ancienne valeur à la nouvelle (morph). Mouvement réduit : statique.
class _TresorerieChart extends StatefulWidget {
  const _TresorerieChart(this.points, this.rtl);
  final List<PointTresorerie> points;
  final bool rtl;
  @override
  State<_TresorerieChart> createState() => _TresorerieChartState();
}

class _TresorerieChartState extends State<_TresorerieChart> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: SuTokens.signature);
  late _Geo _to = _Geo.of(widget.points, widget.rtl);
  late _Geo _from = _to.grounded();
  bool _first = true;

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void didUpdateWidget(_TresorerieChart old) {
    super.didUpdateWidget(old);
    if (old.points == widget.points && old.rtl == widget.rtl) return;
    final courant = _Geo.lerp(_from, _to, SuMotion.easeOut.transform(_c.value));
    final line = _first ? _c.value : 1.0;
    _to = _Geo.of(widget.points, widget.rtl);
    // Changement de sens de lecture : pas de morph (les positions s'inversent), on repart du sol.
    _from = old.rtl == widget.rtl ? courant : _to.grounded();
    _first = old.rtl != widget.rtl || line < 1;
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!Feel.alive || SuMotion.reduced(context)) {
      return CustomPaint(painter: _TresoreriePainter(_to, 1, widget.rtl));
    }
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = SuMotion.easeOut.transform(_c.value);
        return CustomPaint(painter: _TresoreriePainter(_Geo.lerp(_from, _to, t), _first ? t : 1, widget.rtl));
      },
    );
  }
}

/// Barres jumelles encaissements / décaissements sur 12 mois + solde (ligne). Reçoit des ratios
/// déjà ordonnés (RTL géré par [_Geo.of]) ; [line] = part tracée de la ligne de solde (0..1).
class _TresoreriePainter extends CustomPainter {
  _TresoreriePainter(this.geo, this.line, this.rtl);
  final _Geo geo;
  final double line;
  final bool rtl;
  @override
  void paint(Canvas canvas, Size size) {
    if (geo.length == 0) return;
    final slot = size.width / geo.length;
    final h = size.height - 4;
    final base = Paint()..color = SuColors.hairlineStrong..strokeWidth = 1;
    canvas.drawLine(Offset(0, size.height - 1), Offset(size.width, size.height - 1), base);
    final pe = Paint()..color = SuColors.sage;
    final ps = Paint()..color = SuColors.sandMid;
    for (var i = 0; i < geo.length; i++) {
      final x0 = i * slot + slot * 0.18;
      final w = slot * 0.28;
      final he = h * geo.e[i];
      final hs = h * geo.s[i];
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x0, size.height - 1 - he, w, he), const Radius.circular(2)), pe);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x0 + w + slot * 0.08, size.height - 1 - hs, w, hs), const Radius.circular(2)), ps);
    }
    if (line <= 0) return;
    var ligne = Path();
    for (var i = 0; i < geo.length; i++) {
      final y = size.height - 1 - h * geo.y[i];
      final x = i * slot + slot / 2;
      if (i == 0) {
        ligne.moveTo(x, y);
      } else {
        ligne.lineTo(x, y);
      }
    }
    if (line < 1) {
      // La ligne se trace dans le sens de lecture (de la fin vers le début en RTL).
      final partiel = Path();
      for (final m in ligne.computeMetrics()) {
        partiel.addPath(rtl ? m.extractPath(m.length * (1 - line), m.length) : m.extractPath(0, m.length * line), Offset.zero);
      }
      ligne = partiel;
    }
    canvas.drawPath(ligne, Paint()..color = SuColors.ink..style = PaintingStyle.stroke..strokeWidth = 1.6..strokeJoin = StrokeJoin.round);
  }
  @override
  bool shouldRepaint(covariant _TresoreriePainter old) => old.geo != geo || old.line != line || old.rtl != rtl;
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
              StatTile(label: d.rapports.reserve, value: formatMAD(x.reserveConfiguree ? x.reserve : null, l), icon: Icons.savings_rounded, tone: Tone.lilac, hint: x.reserveConfiguree ? null : d.rapports.reserveAbsente),
              StatTile(label: d.rapports.recouvrement, value: x.tauxRecouvrement != null ? '${x.tauxRecouvrement} %' : '—', icon: Icons.insights_rounded, tone: Tone.tosca, hint: x.encaisse != null ? '${d.rapports.encaisse} ${formatMAD(x.encaisse, l)}' : null),
              StatTile(label: d.rapports.impayes, value: formatMAD(x.impayesTotal, l), icon: Icons.warning_amber_rounded, tone: x.nbLotsEnRetard > 0 ? Tone.warn : Tone.sage, hint: fill(d.rapports.lotsEnRetard, {'n': x.nbLotsEnRetard})),
            ]),
            SectionHeader(d.rapports.douzeMois, subtitle: d.rapports.douzeMoisAide),
            SuCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(height: 140, width: double.infinity, child: _TresorerieChart(x.serie, rtl)),
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
                  _Ligne(label: d.enumsRapports.tranche[tr.tranche] ?? tr.tranche, montant: tr.montant, upIsGood: false, ratio: _ratio(tr.montant, x.impayesTotal), color: tr.tranche == '0_30' ? SuColors.toscaDeep : tr.tranche == '31_90' ? SuColors.warn : SuColors.danger, hint: '${tr.nbLots} ${d.rapports.lots.toLowerCase()} · ${tr.nbLignes} ${d.rapports.lignes.toLowerCase()}'),
                if (x.topLots.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(d.rapports.topLots, style: t.titleSmall),
                  for (final lot in x.topLots)
                    ListRow(key: ValueKey(lot.lotId), padding: const EdgeInsets.symmetric(vertical: 8), title: lot.lotNumero, subtitle: '${lot.retardMaxJours} j${lot.conteste ? ' · ${d.rapports.conteste}' : ''}', trailing: _MontantFin(lot.resteDu, color: SuColors.danger, upIsGood: false), onTap: () => context.push('/lots/${lot.lotId}?onglet=finances')),
                ],
              ]),
            ),
            SectionHeader(d.rapports.budget, subtitle: x.budget.budgetId != null ? '${d.rapports.prevu} ${formatMAD(x.budget.budgetMontantTotal, l)} · ${d.rapports.realise} ${formatMAD(x.budget.totaux.realise, l)}' : d.rapports.aucunBudget),
            if (x.budget.postes.isNotEmpty)
              SuCard(child: Column(children: [for (final p in x.budget.postes) _Ligne(label: p.libelle ?? (d.enumsDepenses.categorieDepense[p.categorie] ?? p.categorie), valeur: '${formatMontant(p.realise)} / ${formatMontant(p.montantPrevu)}', ratio: _ratio(p.realise, p.montantPrevu), color: p.depassement ? SuColors.danger : null)])),
            SectionHeader(d.rapports.depenses, subtitle: '${d.rapports.parCategorie} · ${x.exercice}', actionLabel: d.rapports.voirTout, onAction: () => context.push('/depenses')),
            SuCard(child: Column(children: [
              for (final c in x.parCategorie) _Ligne(label: d.enumsDepenses.categorieDepense[c.categorie] ?? c.categorie, montant: c.montant, ratio: _ratio(c.montant, x.depensesTotal), color: SuColors.moss, hint: c.part != null ? '${c.part} % · ${c.nb}' : null),
              if (x.parCategorie.isEmpty) _vide(context, d.rapports.aucuneDepense),
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
          if (rows.isEmpty) return EmptyState(title: d.rapports.aucunRapport, hint: d.rapports.aucunRapportAide, icon: Icons.summarize_rounded, illustration: 'empty-documents');
          return CardList([for (final r in rows) _RapportRow(r, key: ValueKey(r.id))]);
        }),
      ],
    );
  }
}

class _RapportRow extends ConsumerWidget {
  const _RapportRow(this.r, {super.key});
  final RapportGestion r;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final l = context.locale;
    final langue = l.languageCode == 'ar' ? 'ar' : 'fr';
    return ListRow(
      leading: IconCircle(Icons.summarize_rounded, tone: r.statut == 'APPROUVE' ? Tone.ok : r.statut == 'REJETE' ? Tone.danger : Tone.sage),
      title: '${d.rapports.exercice} ${r.exercice}',
      subtitle: '${d.rapports.compteCourant} ${formatMAD(r.compteCourantCloture, l)}${r.tauxRecouvrement != null ? ' · ${r.tauxRecouvrement} %' : ''}',
      trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
        StatusBadge(d.enumsRapports.statutRapport[r.statut] ?? r.statut, variant: rapportVariant[r.statut] ?? BadgeVariant.neutral, small: true),
        const SizedBox(height: 4),
        Text(formatDateCourte(r.genereLe, l), style: Theme.of(context).textTheme.bodySmall),
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
    return SuPage(
      title: d.rapports.transparenceTitre,
      subtitle: d.rapports.transparenceSubtitle,
      onRefresh: () async => ref.invalidate(transparenceProvider),
      children: [
        Segmented<String>(value: _exercice, options: exercices, labelOf: (x) => x, onChanged: (v) => setState(() => _exercice = v)),
        const SizedBox(height: 12),
        SuBanner(tone: BannerTone.info, body: d.rapports.transparenceAide),
        const SizedBox(height: 12),
        SuFadeSwitch(value: _exercice, child: AsyncView(vue, onRetry: () => ref.invalidate(transparenceProvider(_exercice)), data: (x) {
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TwoCols([
              StatTile(label: d.rapports.compteCourant, value: formatMAD(x.compteCourant, l), icon: Icons.account_balance_wallet_rounded, tone: Tone.sage, hint: d.rapports.compteCourantCourt),
              StatTile(label: d.rapports.reserve, value: formatMAD(x.reserveConfiguree ? x.reserve : null, l), icon: Icons.savings_rounded, tone: Tone.lilac, hint: x.reserveConfiguree ? null : d.rapports.reserveAbsente),
              StatTile(label: d.rapports.recouvrement, value: x.tauxRecouvrement != null ? '${x.tauxRecouvrement} %' : '—', icon: Icons.insights_rounded, tone: Tone.tosca, hint: '${d.rapports.encaisse} ${formatMAD(x.encaisse, l)}'),
              StatTile(label: d.rapports.impayes, value: formatMAD(x.impayesTotal, l), icon: Icons.warning_amber_rounded, tone: x.nbLotsEnRetard > 0 ? Tone.warn : Tone.sage, hint: fill(d.rapports.lotsEnRetard, {'n': x.nbLotsEnRetard})),
            ]),
            SectionHeader(d.rapports.budget, subtitle: x.budgetActif ? '${d.rapports.prevu} ${formatMAD(x.budgetPrevu, l)} · ${d.rapports.realise} ${formatMAD(x.budgetRealise, l)}${x.budgetPourcentage != null ? ' · ${x.budgetPourcentage} %' : ''}' : d.rapports.aucunBudget),
            if (x.postes.isNotEmpty)
              SuCard(child: Column(children: [for (final p in x.postes) _Ligne(label: p.libelle, valeur: '${formatMontant(p.realise)} / ${formatMontant(p.montantPrevu)}', ratio: _ratio(p.realise, p.montantPrevu), color: p.depassement ? SuColors.danger : null, hint: d.enumsDepenses.categorieDepense[p.categorie])])),
            SectionHeader(d.rapports.parCategorie, subtitle: '${d.rapports.depenses} · ${formatMAD(x.depensesTotal, l)}'),
            SuCard(child: Column(children: [
              for (final c in x.parCategorie) _Ligne(label: d.enumsDepenses.categorieDepense[c.categorie] ?? c.categorie, montant: c.montant, ratio: _ratio(c.montant, x.depensesTotal), color: SuColors.moss, hint: c.part != null ? '${c.part} %' : null),
              if (x.parCategorie.isEmpty) _vide(context, d.rapports.aucuneDepense),
            ])),
            SectionHeader(d.rapports.depenses, subtitle: x.facturesVisibles ? d.rapports.facturesVisibles : null),
            if (x.depenses.isEmpty)
              _vide(context, d.rapports.aucuneDepense)
            else
              CardList([
                for (final dep in x.depenses)
                  ListRow(
                    key: ValueKey(dep.id),
                    leading: IconCircle(dep.source == 'FONDS_RESERVE' ? Icons.savings_rounded : Icons.receipt_long_rounded, tone: dep.source == 'FONDS_RESERVE' ? Tone.lilac : Tone.sand),
                    title: dep.libelle,
                    subtitle: '${formatDateCourte(dep.date, l)} · ${d.enumsDepenses.categorieDepense[dep.categorie] ?? dep.categorie}${dep.prestataire != null ? ' · ${dep.prestataire}' : ''}',
                    trailing: _MontantFin(
                      dep.montantTtc,
                      secondaire: dep.factures.isEmpty
                          ? null
                          : SuButton(
                              variant: SuButtonVariant.ghost,
                              label: d.rapports.voirFacture,
                              style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28), tapTargetSize: MaterialTapTargetSize.shrinkWrap, textStyle: t.bodySmall?.copyWith(fontWeight: FontWeight.w600, decoration: TextDecoration.underline)),
                              onPressed: () => ouvrirVisionneuse(context, titre: dep.factures.first.numero ?? dep.libelle, url: dep.factures.first.url),
                            ),
                    ),
                  ),
              ]),
            SectionHeader(d.rapports.rapportsSoumis, subtitle: d.rapports.rapportsSoumisAide),
            if (x.rapports.isEmpty)
              _vide(context, d.rapports.aucunRapportSoumis)
            else
              CardList([
                for (final r in x.rapports)
                  ListRow(
                    key: ValueKey(r.documentId),
                    leading: const IconCircle(Icons.summarize_rounded, tone: Tone.ok),
                    title: r.nom,
                    subtitle: formatDateCourte(r.date, l),
                    onTap: () => ouvrirFichierApi(context, ref, endpoint: '/documents/${r.documentId}/download-url', titre: r.nom),
                  ),
              ]),
            if (ctx.isGestion) Padding(padding: const EdgeInsets.only(top: 16), child: Text(d.rapports.facturesVisiblesAide, style: t.bodySmall)),
          ]);
        })),
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
    return SuButton(
      variant: SuButtonVariant.secondary,
      onPressed: () => ouvrirPdfApi(context, ref, endpoint: '/finances/lots/$lotId/releve/pdf', query: {'exercice': exercice, 'langue': langue}, titre: '${d.rapports.releve} $lotNumero $exercice'),
      child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.picture_as_pdf_rounded, size: 18), const SizedBox(width: 8), Flexible(child: Text(d.rapports.releveTelecharger, overflow: TextOverflow.ellipsis))]),
    );
  }
}
