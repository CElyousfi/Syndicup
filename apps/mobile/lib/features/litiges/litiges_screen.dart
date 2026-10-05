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
      fab: ctx.isPrestataire || ctx.isGardien ? null : FloatingActionButton.extended(onPressed: () => showFormSheet<void>(context, title: d.litiges.declarer, builder: (_) => const _LitigeForm()), icon: const Icon(Icons.add_rounded), label: Text(d.litiges.declarer)),
      children: [
        AsyncView(list, onRetry: () => ref.invalidate(litigesProvider), data: (ls) {
          if (ls.isEmpty) return EmptyState(title: d.litiges.aucun, hint: d.litiges.aucunAide, icon: Icons.balance_rounded, illustration: 'empty-litiges');
          final sorted = [...ls]..sort((a, b) => b.creeLe.compareTo(a.creeLe));
          return Column(
            children: [
              for (int i = 0; i < sorted.length; i++)
                SuEnter(
                  index: i,
                  child: Builder(builder: (context) {
                    final x = sorted[i];
                    // Tuile Wise : pastille, objet en gras, date, statut ; description ardoise ;
                    // frise d'escalade ; actions en liens soulignés.
                    return SuCard(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              IconCircle(Icons.balance_rounded, tone: x.statut == 'OUVERT' ? (x.escaladeNiveau >= 2 ? Tone.danger : Tone.sand) : Tone.ok),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(x.type, style: t.titleMedium),
                                    const SizedBox(height: 2),
                                    Text(fill(d.litiges.declareLe, {'date': formatDateCourte(x.creeLe, l)}), style: t.bodySmall),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              StatusBadge(d.enums.statutLitige[x.statut] ?? x.statut, variant: litigeVariant[x.statut] ?? BadgeVariant.neutral, small: true),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text(x.description, style: t.bodyMedium?.copyWith(color: SuColors.soft, height: 1.45), maxLines: 4, overflow: TextOverflow.ellipsis),
                          const SizedBox(height: 18),
                          _Stepper(niveau: x.escaladeNiveau),
                          if (gestion && x.statut == 'OUVERT' && ctx.isGestion)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  if (x.escaladeNiveau < 2) LinkButton(d.litiges.escalader, color: SuColors.danger, onTap: () => _escalader(context, ref, x)),
                                  const SizedBox(width: 12),
                                  LinkButton(d.litiges.cloturer, onTap: () => _cloturer(context, ref, x)),
                                ],
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
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
        SuBanner(tone: BannerTone.warn, body: fill(d.litiges.escaladerCorps, {'niveau': d.enums.escaladeLitige['${x.escaladeNiveau + 1}'] ?? ''})),
        const SizedBox(height: 16),
        SuField(label: d.litiges.escaladeMotif, controller: ctrl, maxLines: 3, required: true),
        const SizedBox(height: 16),
        SubmitButton(label: d.litiges.escalader, danger: true, onPressed: () async {
          final ok = await confirmDialog(sheet, title: d.litiges.escalader, body: fill(d.litiges.escaladerCorps, {'niveau': d.enums.escaladeLitige['${x.escaladeNiveau + 1}'] ?? ''}), danger: true, irreversible: true);
          if (!ok) return;
          final r = await ref.read(apiClientProvider).patch<dynamic>('/litiges/${x.id}/escalade', body: {'motif': ctrl.text.trim()});
          if (!sheet.mounted) return;
          if (r is ApiFail) {
            showToast(sheet, r.error.message, error: true);
          } else {
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
          if (r is ApiFail) {
            showToast(sheet, r.error.message, error: true);
          } else {
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
    // Frise Wise (suivi de transfert) : étapes franchies en vert profond pleines, à venir en
    // voile d'encre ; filets arrondis entre les pastilles.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i <= 2; i++) ...[
          Expanded(
            flex: 3,
            child: Column(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: i <= niveau ? SuColors.link : SuColors.washStrong, shape: BoxShape.circle),
                  child: i < niveau
                      ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                      : Text('$i', style: t.labelMedium?.copyWith(color: i <= niveau ? Colors.white : SuColors.soft, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 6),
                Text(d.enums.escaladeLitige['$i'] ?? '$i', style: t.labelSmall?.copyWith(color: i == niveau ? SuColors.ink : SuColors.soft, fontWeight: i == niveau ? FontWeight.w700 : FontWeight.w500, height: 1.3), textAlign: TextAlign.center, maxLines: 4),
              ],
            ),
          ),
          if (i < 2)
            Expanded(
              flex: 2,
              child: Container(height: 3, margin: const EdgeInsets.only(top: 13.5), decoration: BoxDecoration(color: i < niveau ? SuColors.link : SuColors.washStrong, borderRadius: BorderRadius.circular(999))),
            ),
        ],
      ],
    );
  }
}

/// Sépare un message « Phrase courte. Explication. » en (titre sans point final, suite).
(String, String?) _scinder(String s) {
  final m = RegExp(r'^(.+?)[.!?؟]\s+(.+)$', dotAll: true).firstMatch(s.trim());
  if (m == null) return (s.trim(), null);
  return (m[1]!, m[2]);
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
            if (!context.mounted) return;
            if (r is ApiFail) {
              setState(() {
                _loading = false;
                _fail = r;
              });
              return;
            }
            ref.invalidate(litigesProvider);
            // Succès plein écran (contexte racine : la feuille se ferme). « Litige déclaré. Le
            // syndic va l'examiner. » → titre-affiche = 1re phrase, explication = la suite.
            final root = Navigator.of(context, rootNavigator: true).context;
            final (titre, corps) = _scinder(d.litiges.declare);
            Navigator.pop(context);
            showSuccess(root, title: titre, body: corps, illustration: 'ok-general');
          },
        ),
      ],
    );
  }
}
