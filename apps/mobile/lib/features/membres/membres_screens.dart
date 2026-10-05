import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

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

/// J3 — annuaire des membres (syndic) + fiche membre avec zone danger (anonymisation CNDP).
class MembresScreen extends ConsumerStatefulWidget {
  const MembresScreen({super.key});
  @override
  ConsumerState<MembresScreen> createState() => _MembresScreenState();
}

class _MembresScreenState extends ConsumerState<MembresScreen> {
  String _q = '';
  String _role = 'TOUS';
  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final t = Theme.of(context).textTheme;
    final membres = ref.watch(membresProvider);
    return SuPage(
      title: d.membres.annuaire,
      subtitle: d.membres.annuaireSubtitle,
      onRefresh: () async => ref.invalidate(membresProvider),
      actions: [CircleIconButton(onTap: () => context.push('/invitations?nouvelle=1'), icon: Icons.person_add_alt_1_rounded, tooltip: d.membres.inviter)],
      children: [
        TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: InputDecoration(hintText: d.membres.rechercher, prefixIcon: const Icon(Icons.search_rounded))),
        const SizedBox(height: 10),
        FilterChips<String>(value: _role, options: ['TOUS', ...d.roles.keys.where((r) => r != 'SUPER_ADMIN')], labelOf: (v) => v == 'TOUS' ? d.membres.tousRoles : d.roles[v]!, onChanged: (v) => setState(() => _role = v)),
        const SizedBox(height: 12),
        AsyncView(membres, onRetry: () => ref.invalidate(membresProvider), data: (list) {
          final visible = list.where((m) {
            final nom = '${m.prenom ?? ''} ${m.nom ?? ''} ${m.email ?? ''} ${m.telephone ?? ''}'.toLowerCase();
            return (_q.isEmpty || nom.contains(_q)) && (_role == 'TOUS' || m.roles.any((r) => r.role == _role && r.actif));
          }).toList();
          // Annuaire vide → invitation à inviter ; filtre / recherche sans résultat → illustration recherche.
          if (visible.isEmpty) return EmptyState(title: d.membres.aucun, hint: list.isEmpty ? d.membres.aucunAide : null, icon: Icons.group_rounded, illustration: list.isEmpty ? 'empty-personnel' : 'empty-search');
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fill(d.membres.total, {'n': visible.length, 'count': visible.length}), style: t.bodyMedium?.copyWith(color: SuColors.soft)),
              const SizedBox(height: 4),
              CardList([
                for (final m in visible)
                  ListRow(
                    leading: Avatar(nomComplet(m.prenom, m.nom) ?? m.email ?? '?', size: 48),
                    title: nomComplet(m.prenom, m.nom) ?? m.email ?? m.id.substring(0, 8),
                    subtitle: [
                      m.roles.where((r) => r.actif).map((r) => d.roles[r.role] ?? r.role).join(', '),
                      if (m.lots.isNotEmpty) m.lots.map((x) => x.numero).join(', ') else d.membres.sansLot,
                    ].join(' · '),
                    trailing: StatusBadge(d.enums.statutCompte[m.statutCompte] ?? m.statutCompte, variant: compteVariant[m.statutCompte] ?? BadgeVariant.neutral, small: true),
                    onTap: () => context.push('/membres/${m.id}'),
                  ),
              ]),
            ],
          );
        }),
      ],
    );
  }
}

class MembreDetailScreen extends ConsumerWidget {
  const MembreDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final d = context.dict;
    final l = context.locale;
    final t = Theme.of(context).textTheme;
    final membre = ref.watch(membreProvider(id));
    final annuaire = (ref.watch(membresProvider).valueOrNull ?? const <Membre>[]).where((m) => m.id == id).firstOrNull;
    return SuPage(
      title: d.membres.titre,
      children: [
        AsyncView(membre, onRetry: () => ref.invalidate(membreProvider(id)), data: (p) {
          final nom = nomComplet(p.prenom, p.nom) ?? p.email ?? '—';
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // En-tête Wise : grand avatar centré, nom gras, statut du compte.
              SuEnter(
                child: Column(
                  children: [
                    Avatar(nom, size: 96),
                    const SizedBox(height: 14),
                    Text(nom, style: t.displaySmall, textAlign: TextAlign.center),
                    if (p.roles.any((r) => r.actif)) Padding(padding: const EdgeInsets.only(top: 4), child: Text(p.roles.where((r) => r.actif).map((r) => d.roles[r.role] ?? r.role).join(' · '), style: t.bodyMedium?.copyWith(color: SuColors.soft), textAlign: TextAlign.center)),
                    const SizedBox(height: 10),
                    StatusBadge(d.enums.statutCompte[p.statutCompte] ?? p.statutCompte, variant: compteVariant[p.statutCompte] ?? BadgeVariant.neutral),
                  ],
                ),
              ),
              SectionHeader(d.membres.colContact),
              SuCard(child: Column(children: [
                KeyValueRow(d.auth.phoneLabel, formatTelephone(p.telephone), valueWidget: p.telephone == null ? null : Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () => launchUrl(Uri.parse('tel:${p.telephone}')), style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 32)), child: Text(formatTelephone(p.telephone))))),
                KeyValueRow(d.auth.emailLabel, p.email ?? '—'),
                KeyValueRow(d.profil.langue, p.languePreferee == 'AR' ? d.common.arabic : d.common.french),
                if (annuaire != null) KeyValueRow(d.membres.colDepuis, formatDateCourte(annuaire.membreDepuis, l)),
              ])),
              SectionHeader(d.membres.roles),
              CardList([for (final r in p.roles) ListRow(leading: IconCircle(Icons.badge_rounded, tone: r.actif ? Tone.lilac : Tone.neutral), title: d.roles[r.role] ?? r.role, trailing: r.actif ? null : StatusBadge(d.membres.roleInactif, variant: BadgeVariant.outline, small: true))]),
              if (annuaire != null && annuaire.lots.isNotEmpty) ...[
                SectionHeader(d.membres.colLots),
                CardList([for (final x in annuaire.lots) ListRow(leading: const IconCircle(Icons.home_rounded, tone: Tone.sand), title: x.numero, subtitle: x.lien == 'PROPRIETAIRE' ? d.membres.proprietaireDe : d.membres.occupantDe, onTap: () => context.push('/lots/${x.id}'))]),
              ],
              if (ctx.isGestion) ...[
                SectionHeader(d.membres.zoneDanger),
                // Zone sensible : tuile teintée danger, plate (pas de liseré).
                SuCard(
                  color: SuColors.dangerTint,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.no_accounts_rounded, color: SuColors.danger, size: 24),
                          const SizedBox(width: 10),
                          Expanded(child: Text(d.membres.anonymiser, style: t.titleMedium?.copyWith(color: SuColors.danger))),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(d.membres.anonymiserCorps, style: t.bodyMedium?.copyWith(color: SuColors.body)),
                      const SizedBox(height: 14),
                      if (p.statutCompte != 'DESACTIVE') Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(d.membres.anonymiserRefus, style: t.bodySmall)),
                      SubmitButton(
                        label: d.membres.anonymiser,
                        danger: true,
                        onPressed: p.statutCompte != 'DESACTIVE'
                            ? null
                            : () async {
                                final ok1 = await confirmDialog(context, title: d.membres.anonymiser, body: d.membres.anonymiserCorps, danger: true, irreversible: true);
                                if (!ok1 || !context.mounted) return;
                                final ok2 = await confirmDialog(context, title: d.membres.anonymiserConfirme, body: d.common.irreversible, danger: true, confirmLabel: d.membres.anonymiser);
                                if (!ok2 || !context.mounted) return;
                                final r = await ref.read(apiClientProvider).post<dynamic>('/users/$id/anonymize', idempotent: true);
                                if (!context.mounted) return;
                                if (r is ApiFail) showToast(context, r.error.message, error: true); else {
                                  ref.invalidate(membreProvider(id));
                                  ref.invalidate(membresProvider);
                                  showToast(context, d.membres.anonymise);
                                }
                              },
                      ),
                    ],
                  ),
                ),
              ],
            ],
          );
        }),
      ],
    );
  }
}
