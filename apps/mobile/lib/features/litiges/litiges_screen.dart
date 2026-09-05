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

/// I3 — litiges : déclarer, suivre ; syndic/conseil : escalader (stepper 0→1→2), clôturer.
class LitigesScreen extends ConsumerWidget {
  const LitigesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final list = ref.watch(litigesProvider);
    final gestion = ctx.isGestion || ctx.isConseil;
    return SuPage(
      title: gestion ? d.litiges.titre : d.litiges.mesLitiges,
      onRefresh: () async => ref.invalidate(litigesProvider),
      fab: ctx.isPrestataire || ctx.isGardien ? null : FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: d.litiges.declarer, builder: (_) => const _LitigeForm()), backgroundColor: SuColors.ink, foregroundColor: Colors.white, icon: const Icon(Icons.add_rounded), label: Text(d.litiges.declarer)),
      children: [
        AsyncView(list, onRetry: () => ref.invalidate(litigesProvider), data: (ls) {
          if (ls.isEmpty) return EmptyState(title: d.litiges.aucun, hint: d.litiges.aucunAide, icon: Icons.balance_rounded);
          final sorted = [...ls]..sort((a, b) => b.creeLe.compareTo(a.creeLe));
          return Column(
            children: [
              for (final x in sorted)
                SuCard(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [Expanded(child: Text(x.type, style: t.titleSmall)), StatusBadge(d.enums.statutLitige[x.statut] ?? x.statut, variant: litigeVariant[x.statut] ?? BadgeVariant.neutral, small: true)]),
                      const SizedBox(height: 4),
                      Text(x.description, style: t.bodyMedium, maxLines: 4, overflow: TextOverflow.ellipsis),
                      Text(fill(d.litiges.declareLe, {'date': formatDateCourte(x.creeLe, l)}), style: t.labelSmall),
                      const SizedBox(height: 12),
                      _Stepper(niveau: x.escaladeNiveau),
                      if (gestion && x.statut == 'OUVERT')
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (x.escaladeNiveau < 2 && ctx.isGestion) TextButton(onPressed: () => _escalader(context, ref, x), child: Text(d.litiges.escalader)),
                            if (ctx.isGestion) TextButton(onPressed: () => _cloturer(context, ref, x), child: Text(d.litiges.cloturer)),
                          ],
                        ),
                    ],
                  ),
                ),
            ],
          );
        }),
      ],
    );
  }

  Future<void> _escalader(BuildContext context, WidgetRef ref, Litige x) async {
    final d = context.dict;
    final ctrl = TextEditingController();
    await showFormSheet<void>(context, title: d.litiges.escaladerTitre, builder: (sheet) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(fill(d.litiges.escaladerCorps, {'niveau': d.enums.escaladeLitige['${x.escaladeNiveau + 1}'] ?? ''}), style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuField(label: d.litiges.escaladeMotif, controller: ctrl, maxLines: 3, required: true),
        const SizedBox(height: 16),
        SubmitButton(label: d.litiges.escalader, danger: true, onPressed: () async {
          final ok = await confirmDialog(sheet, title: d.litiges.escalader, body: fill(d.litiges.escaladerCorps, {'niveau': d.enums.escaladeLitige['${x.escaladeNiveau + 1}'] ?? ''}), danger: true, irreversible: true);
          if (!ok) return;
          final r = await ref.read(apiClientProvider).patch<dynamic>('/litiges/${x.id}/escalade', body: {'motif': ctrl.text.trim()});
          if (!sheet.mounted) return;
          if (r is ApiFail) showToast(sheet, r.error.message, error: true); else {
            ref.invalidate(litigesProvider);
            Navigator.pop(sheet);
            showToast(context, d.litiges.escalade);
          }
        }),
      ],
    ));
  }

  Future<void> _cloturer(BuildContext context, WidgetRef ref, Litige x) async {
    final d = context.dict;
    final ctrl = TextEditingController();
    String statut = 'RESOLU';
    await showFormSheet<void>(context, title: d.litiges.cloturerTitre, builder: (sheet) => StatefulBuilder(builder: (_, setS) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Segmented<String>(value: statut, options: const ['RESOLU', 'CLOS'], labelOf: (v) => d.enums.statutLitige[v] ?? v, onChanged: (v) => setS(() => statut = v)),
        const SizedBox(height: 6),
        Text(d.litiges.cloturerAide, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 12),
        SuField(label: d.litiges.cloturerMotif, controller: ctrl, maxLines: 3, required: true),
        const SizedBox(height: 16),
        SubmitButton(label: d.litiges.cloturer, onPressed: () async {
          final r = await ref.read(apiClientProvider).patch<dynamic>('/litiges/${x.id}/statut', body: {'statut': statut, 'motif': ctrl.text.trim()});
          if (!sheet.mounted) return;
          if (r is ApiFail) showToast(sheet, r.error.message, error: true); else {
            ref.invalidate(litigesProvider);
            Navigator.pop(sheet);
            showToast(context, d.litiges.cloture);
          }
        }),
      ],
    )));
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.niveau});
  final int niveau;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    return Row(
      children: [
        for (int i = 0; i <= 2; i++) ...[
          Expanded(
            child: Column(
              children: [
                Container(width: 26, height: 26, alignment: Alignment.center, decoration: BoxDecoration(color: i <= niveau ? SuColors.ink : SuColors.ground, shape: BoxShape.circle, border: Border.all(color: i <= niveau ? SuColors.ink : SuColors.hairlineStrong)), child: Text('$i', style: t.labelSmall?.copyWith(color: i <= niveau ? Colors.white : SuColors.faint, fontWeight: FontWeight.w700))),
                const SizedBox(height: 4),
                Text(d.enums.escaladeLitige['$i'] ?? '$i', style: t.labelSmall?.copyWith(color: i == niveau ? SuColors.ink : SuColors.faint, fontWeight: i == niveau ? FontWeight.w700 : FontWeight.w500), textAlign: TextAlign.center, maxLines: 2),
              ],
            ),
          ),
          if (i < 2) Expanded(child: Container(height: 2, margin: const EdgeInsets.only(bottom: 22), color: i < niveau ? SuColors.ink : SuColors.hairline)),
        ],
      ],
    );
  }
}

class _LitigeForm extends ConsumerStatefulWidget {
  const _LitigeForm();
  @override
  ConsumerState<_LitigeForm> createState() => _LitigeFormState();
}

class _LitigeFormState extends ConsumerState<_LitigeForm> {
  final _type = TextEditingController(), _desc = TextEditingController();
  bool _loading = false;
  ApiFail? _fail;
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SuField(label: d.litiges.type, controller: _type, hint: d.litiges.typeHint, required: true, maxLength: 120, error: fieldError(_fail, 'type')),
        const SizedBox(height: 12),
        SuField(label: d.litiges.description, controller: _desc, hint: d.litiges.descriptionHint, maxLines: 5, required: true, error: fieldError(_fail, 'description')),
        const SizedBox(height: 16),
        FormError(_fail),
        if (_fail != null) const SizedBox(height: 12),
        SubmitButton(
          label: d.litiges.declarer,
          loading: _loading,
          onPressed: () async {
            setState(() {
              _loading = true;
              _fail = null;
            });
            final r = await ref.read(apiClientProvider).post<dynamic>('/litiges', body: {'type': _type.text.trim(), 'description': _desc.text.trim()});
            if (!mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(litigesProvider);
            Navigator.pop(context);
            showToast(context, d.litiges.declare);
          },
        ),
      ],
    );
  }
}
