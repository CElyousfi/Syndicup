import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';
import '../parkings/parkings_screens.dart' show ShellHeaderWithBottom;

/// Espace cabinet (M25) — lecture : portefeuille (une carte par copropriété, KPI), alertes, agenda.
/// La gestion (membres, mandats, prestataires, paramètres) est web-first (docs/PARITE_WEB_MOBILE.md).
class CabinetScreen extends ConsumerStatefulWidget {
  const CabinetScreen({super.key, this.cabinetId});
  final String? cabinetId;
  @override
  ConsumerState<CabinetScreen> createState() => _CabinetScreenState();
}

class _CabinetScreenState extends ConsumerState<CabinetScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  String? _cabinetId;
  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = d.cabinet;
    final cabinets = ref.watch(cabinetsProvider);
    final racine = !context.canPop();
    final bar = TabBar(controller: _tabs, tabs: [Tab(text: t.onglets.portefeuille), Tab(text: t.onglets.alertes), Tab(text: t.onglets.agenda)]);
    return Scaffold(
      appBar: racine ? ShellHeaderWithBottom(title: t.titre, bottom: bar) : AppBar(title: Text(t.titre), bottom: bar),
      body: AsyncView(cabinets, onRetry: () => ref.invalidate(cabinetsProvider), data: (liste) {
        if (liste.isEmpty) return Padding(padding: const EdgeInsets.all(16), child: EmptyState(title: t.aucunCabinet, hint: t.aucunCabinetAide, icon: Icons.business_center_rounded));
        final cabinet = liste.where((c) => c.id == (_cabinetId ?? widget.cabinetId)).firstOrNull ?? liste.first;
        return Column(children: [
          if (liste.length > 1)
            Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: FilterChips<String>(value: cabinet.id, options: liste.map((c) => c.id).toList(), labelOf: (id) => liste.firstWhere((c) => c.id == id).nom, onChanged: (id) => setState(() => _cabinetId = id))),
          Expanded(child: TabBarView(controller: _tabs, children: [_PortefeuilleTab(cabinet: cabinet), _AlertesTab(cabinetId: cabinet.id), _AgendaTab(cabinetId: cabinet.id)])),
        ]);
      }),
    );
  }
}

class _PortefeuilleTab extends ConsumerWidget {
  const _PortefeuilleTab({required this.cabinet});
  final Cabinet cabinet;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = context.dict;
    final t = d.cabinet;
    final l = context.locale;
    final tt = Theme.of(context).textTheme;
    final lignes = ref.watch(portefeuilleProvider(cabinet.id));
    Color couleurTaux(double? x) => x == null ? SuColors.faint : x >= 80 ? SuColors.ok : x >= 60 ? SuColors.warn : SuColors.danger;
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(portefeuilleProvider(cabinet.id)),
      color: SuColors.action,
      child: AsyncView(lignes, onRetry: () => ref.invalidate(portefeuilleProvider(cabinet.id)), data: (rows) {
        if (rows.isEmpty) return ListView(padding: const EdgeInsets.all(16), children: [EmptyState(title: t.aucuneCopropriete, icon: Icons.apartment_rounded)]);
        final alertes = rows.fold<int>(0, (a, r) => a + r.alertes.length);
        return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
          Text('${cabinet.nom} · ${cabinet.monRole != null ? (t.roles[cabinet.monRole!] ?? cabinet.monRole!) : ''}', style: tt.bodySmall),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: StatTile(label: t.coproprietes, value: '${rows.length}', icon: Icons.apartment_rounded)),
            const SizedBox(width: 8),
            Expanded(child: StatTile(label: t.alertes, value: '$alertes', icon: Icons.warning_amber_rounded, tone: alertes > 0 ? Tone.warn : Tone.sage)),
          ]),
          const SizedBox(height: 12),
          for (final r in rows)
            SuCard(margin: const EdgeInsets.only(bottom: 10), border: r.alertes.isNotEmpty ? SuColors.warnBorder : null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text(r.nom, style: tt.titleSmall)), StatusBadge(r.assuranceActive ? t.assuranceOk : t.assuranceAbsente, variant: r.assuranceActive ? BadgeVariant.ok : BadgeVariant.danger, small: true)]),
              Text('${r.ville} · ${r.nbLots} ${t.lots.toLowerCase()}${r.honorairesMensuels != null ? ' · ${formatMAD(r.honorairesMensuels, l)}' : ''}', style: tt.bodySmall),
              const SizedBox(height: 10),
              Row(children: [Expanded(child: Gauge((r.tauxRecouvrement ?? 0) / 100, color: couleurTaux(r.tauxRecouvrement))), const SizedBox(width: 10), Text(r.tauxRecouvrement == null ? '—' : '${r.tauxRecouvrement!.toStringAsFixed(0)} %', style: tt.labelLarge?.copyWith(color: couleurTaux(r.tauxRecouvrement)))]),
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                StatusBadge('${t.impayes} ${formatMAD(r.impayesMontant, l)}', variant: r.impayesNbLots > 0 ? BadgeVariant.warn : BadgeVariant.neutral, small: true),
                StatusBadge('${t.incidents} ${r.incidentsOuverts}', variant: r.incidentsUrgents > 0 ? BadgeVariant.danger : BadgeVariant.neutral, small: true),
                StatusBadge('${t.taches} ${r.tachesRetard}', variant: r.tachesRetard > 0 ? BadgeVariant.danger : BadgeVariant.neutral, small: true),
                StatusBadge('${t.justificatifs} ${r.justificatifsEnAttente}', variant: r.justificatifsEnAttente > 0 ? BadgeVariant.info : BadgeVariant.neutral, small: true),
                if (r.prochaineAg != null) StatusBadge('${t.prochaineAg} ${formatJourAnnee(r.prochaineAg!.substring(0, 10), l)}', variant: BadgeVariant.outline, small: true),
              ]),
            ])),
          if (rows.isNotEmpty) Text(fill(t.calculeLe, {'date': formatDateHeure(rows.first.calculeLe, l)}), style: tt.labelSmall),
        ]);
      }),
    );
  }
}

class _AlertesTab extends ConsumerWidget {
  const _AlertesTab({required this.cabinetId});
  final String cabinetId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.dict.cabinet;
    final liste = ref.watch(alertesCabinetProvider(cabinetId));
    String libelle(AlerteCabinet a) => fill(t.codesAlerte[a.code] ?? a.code, {'v': a.valeur ?? ''});
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(alertesCabinetProvider(cabinetId)),
      color: SuColors.action,
      child: AsyncView(liste, onRetry: () => ref.invalidate(alertesCabinetProvider(cabinetId)), data: (rows) => rows.isEmpty
          ? ListView(padding: const EdgeInsets.all(16), children: [EmptyState(title: t.aucuneAlerte, icon: Icons.check_circle_outline_rounded, tone: Tone.ok)])
          : ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [CardList([for (final a in rows) ListRow(leading: IconCircle(a.niveau == 'danger' ? Icons.error_outline_rounded : Icons.warning_amber_rounded, tone: a.niveau == 'danger' ? Tone.danger : Tone.warn, size: 40), title: libelle(a), subtitle: a.copropriete)])])),
    );
  }
}

class _AgendaTab extends ConsumerWidget {
  const _AgendaTab({required this.cabinetId});
  final String cabinetId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.dict.cabinet;
    final l = context.locale;
    final liste = ref.watch(agendaCabinetProvider(cabinetId));
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(agendaCabinetProvider(cabinetId)),
      color: SuColors.action,
      child: AsyncView(liste, onRetry: () => ref.invalidate(agendaCabinetProvider(cabinetId)), data: (rows) => rows.isEmpty
          ? ListView(padding: const EdgeInsets.all(16), children: [EmptyState(title: t.aucunEvenement, icon: Icons.event_note_rounded)])
          : ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 32), children: [
              Text(t.agendaAide, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 10),
              CardList([for (final e in rows) ListRow(leading: IconCircle(switch (e.type) { 'AG' => Icons.how_to_vote_rounded, 'ECHEANCE_CONTRAT' => Icons.handshake_rounded, 'TACHE' => Icons.task_alt_rounded, 'PAIE' => Icons.payments_rounded, _ => Icons.flag_rounded }, tone: e.retard ? Tone.danger : Tone.sage, size: 40), title: e.titre, subtitle: '${formatJourAnnee(e.date.substring(0, 10), l)} · ${e.copropriete} · ${t.typesEvenement[e.type] ?? e.type}${e.retard ? ' · ${t.enRetard}' : ''}')]),
            ])),
    );
  }
}
