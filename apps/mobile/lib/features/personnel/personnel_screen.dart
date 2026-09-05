import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';

/// H1 — fiches gardien (statut PRESENT/ABSENT/REMPLACE, logement de service).
class PersonnelScreen extends ConsumerWidget {
  const PersonnelScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final list = ref.watch(personnelProvider);
    final lots = ref.watch(lotsProvider).valueOrNull ?? const <Lot>[];
    final membres = ref.watch(membresProvider).valueOrNull ?? const <Membre>[];
    String nom(String id) {
      final m = membres.where((x) => x.id == id).firstOrNull;
      return nomComplet(m?.prenom, m?.nom) ?? (id == ctx.profil.id ? (nomComplet(ctx.profil.prenom, ctx.profil.nom) ?? d.personnel.maFiche) : id.substring(0, 8));
    }

    return SuPage(
      title: d.personnel.titre,
      subtitle: d.personnel.subtitle,
      onRefresh: () async => ref.invalidate(personnelProvider),
      fab: ctx.isGestion ? FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: d.personnel.nouvelleFiche, builder: (_) => _PersonnelForm(lots: lots)), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.personnel.nouvelleFiche)) : null,
      children: [
        AsyncView(list, onRetry: () => ref.invalidate(personnelProvider), data: (ps) {
          if (ps.isEmpty) return EmptyState(title: d.personnel.aucuneFiche, hint: ctx.isGestion ? d.personnel.aucuneFicheAide : null, icon: Icons.group_rounded);
          return Column(
            children: [
              if (ps.any((p) => p.statut == 'ABSENT')) Padding(padding: const EdgeInsets.only(bottom: 12), child: SuBanner(tone: BannerTone.warn, body: d.personnel.absentAlerte)),
              CardList([
                for (final p in ps)
                  ListRow(
                    leading: Avatar(nom(p.utilisateurId), size: 40),
                    title: nom(p.utilisateurId),
                    subtitle: '${d.personnel.logement} : ${lots.where((x) => x.id == p.logementLotId).map((x) => x.numero).firstOrNull ?? d.personnel.aucuneLoge} · ${fill(d.common.sinceDate, {'date': formatDateCourte(p.creeLe, l)})}',
                    trailing: StatusBadge(d.enums.statutPersonnel[p.statut] ?? p.statut, variant: personnelVariant[p.statut] ?? BadgeVariant.neutral, small: true),
                    onTap: ctx.isGestion ? () => showFormSheet<void>(context, title: d.personnel.changerStatut, builder: (_) => _StatutForm(p: p, lots: lots)) : null,
                  ),
              ]),
            ],
          );
        }),
      ],
    );
  }
}

class _PersonnelForm extends ConsumerStatefulWidget {
  const _PersonnelForm({required this.lots});
  final List<Lot> lots;
  @override
  ConsumerState<_PersonnelForm> createState() => _PersonnelFormState();
}

class _PersonnelFormState extends ConsumerState<_PersonnelForm> {
  final _user = TextEditingController();
  String _statut = 'PRESENT';
  String? _lot;
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final loges = widget.lots.where((x) => x.typeLot == 'LOGE_GARDIEN').toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.lots.utilisateur, controller: _user, help: d.personnel.utilisateurAide, required: true, mono: true, textDirection: TextDirection.ltr, error: fieldError(_fail, 'utilisateur_id')),
        const SizedBox(height: 12),
        SuSelect<String>(label: d.personnel.statut, value: _statut, options: const ['PRESENT', 'ABSENT', 'REMPLACE'], labelOf: (v) => d.enums.statutPersonnel[v] ?? v, onChanged: (v) => setState(() => _statut = v)),
        const SizedBox(height: 12),
        SuSelect<String?>(label: d.personnel.logement, value: _lot, options: [null, ...loges.map((x) => x.id)], labelOf: (v) => v == null ? d.personnel.aucuneLoge : loges.firstWhere((x) => x.id == v).numero, onChanged: (v) => setState(() => _lot = v), help: d.personnel.logementAide),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.common.create,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/personnel', body: {'utilisateur_id': _user.text.trim(), 'statut': _statut, 'logement_lot_id': _lot});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(personnelProvider);
            Navigator.pop(context);
            showToast(context, d.personnel.ficheCreee);
          },
        ),
      ],
    );
  }
}

class _StatutForm extends ConsumerStatefulWidget {
  const _StatutForm({required this.p, required this.lots});
  final Personnel p;
  final List<Lot> lots;
  @override
  ConsumerState<_StatutForm> createState() => _StatutFormState();
}

class _StatutFormState extends ConsumerState<_StatutForm> {
  late String _statut = widget.p.statut;
  late String? _lot = widget.p.logementLotId;
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final loges = widget.lots.where((x) => x.typeLot == 'LOGE_GARDIEN' || x.id == _lot).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuSelect<String>(label: d.personnel.statut, value: _statut, options: const ['PRESENT', 'ABSENT', 'REMPLACE'], labelOf: (v) => d.enums.statutPersonnel[v] ?? v, onChanged: (v) => setState(() => _statut = v)),
        const SizedBox(height: 12),
        SuSelect<String?>(label: d.personnel.logement, value: _lot, options: [null, ...loges.map((x) => x.id)], labelOf: (v) => v == null ? d.personnel.aucuneLoge : loges.firstWhere((x) => x.id == v).numero, onChanged: (v) => setState(() => _lot = v)),
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
            final r = await ref.read(apiClientProvider).patch<dynamic>('/personnel/${widget.p.id}/statut', body: {'statut': _statut, 'logement_lot_id': _lot});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(personnelProvider);
            Navigator.pop(context);
            showToast(context, d.personnel.statutChange);
          },
        ),
      ],
    );
  }
}
