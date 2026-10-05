import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/realtime/notifications_live.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/notifications_link.dart';
import '../../core/widgets/widgets.dart';

/// I2 — centre de notifications : titre/corps rendus dans MA langue, lu/non-lu, deep-link.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _nonLues = false;

  Future<void> _lire(NotificationItem n) async {
    if (!n.lu) {
      ref.read(notificationsLiveProvider.notifier).decrement();
      await ref.read(apiClientProvider).patch<dynamic>('/notifications/${n.id}/read');
      ref.invalidate(notificationsProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final notifs = ref.watch(notificationsProvider);
    return SuPage(
      title: d.notifs.titre,
      onRefresh: () async => ref.invalidate(notificationsProvider),
      actions: [
        TextButton(
          onPressed: () async {
            final list = notifs.valueOrNull ?? const <NotificationItem>[];
            for (final n in list.where((x) => !x.lu)) {
              await ref.read(apiClientProvider).patch<dynamic>('/notifications/${n.id}/read');
            }
            ref.read(notificationsLiveProvider.notifier).setUnread(0);
            ref.invalidate(notificationsProvider);
          },
          child: Text(d.notifs.toutesLues),
        ),
      ],
      children: [
        Segmented<bool>(value: _nonLues, options: const [false, true], labelOf: (v) => v ? fill(d.notifs.nonLues, {'n': (notifs.valueOrNull ?? const []).where((x) => !x.lu).length}) : '${d.common.all} · ${notifs.valueOrNull?.length ?? 0}', onChanged: (v) => setState(() => _nonLues = v)),
        const SizedBox(height: 4),
        AsyncView(notifs, onRetry: () => ref.invalidate(notificationsProvider), data: (list) {
          final visible = list.where((n) => !_nonLues || !n.lu).toList()..sort((a, b) => b.horodatageEnvoi.compareTo(a.horodatageEnvoi));
          if (visible.isEmpty) {
            return Padding(padding: const EdgeInsets.only(top: 12), child: EmptyState(title: d.notifs.aucune, hint: d.notifs.aucuneAide, icon: Icons.notifications_none_rounded, illustration: 'empty-notifications'));
          }
          // Fil d'activité Wise : regroupé par jour (Aujourd'hui, Hier, puis la date).
          final groupes = <String, List<NotificationItem>>{};
          for (final n in visible) {
            groupes.putIfAbsent(_jour(context, n.horodatageEnvoi), () => []).add(n);
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final g in groupes.entries) ...[
                SectionHeader(g.key),
                CardList([
                  for (final n in g.value)
                    _NotifRow(
                      n: n,
                      icon: _icon(n.templateCode),
                      meta: n.statutEnvoi == 'EN_ATTENTE' ? '${formatHeure(n.horodatageEnvoi, l)} · ${fill(d.notifs.envoiEnAttente, {'canal': (d.enums.canal[n.canal] ?? n.canal).toLowerCase()})}' : '${d.enums.canal[n.canal] ?? n.canal} · ${formatHeure(n.horodatageEnvoi, l)}',
                      onTap: () {
                        _lire(n);
                        context.push(lienNotification(n.templateCode, n.contenuJson));
                      },
                    ),
                ]),
              ],
            ],
          );
        }),
      ],
    );
  }

  /// Libellé du jour (heure locale) : « Aujourd'hui », « Hier », sinon la date longue.
  String _jour(BuildContext context, String iso) {
    final d = context.dict;
    final t = DateTime.tryParse(iso)?.toLocal();
    if (t == null) return '—';
    final now = DateTime.now();
    final jour = DateTime(t.year, t.month, t.day);
    final ecart = DateTime(now.year, now.month, now.day).difference(jour).inDays;
    if (ecart == 0) return d.common.today;
    if (ecart == 1) return d.common.yesterday;
    return formatDate(iso, context.locale);
  }

  IconData _icon(String code) {
    if (code.startsWith('VISITE_')) return Icons.meeting_room_rounded;
    if (code.startsWith('INCIDENT_')) return Icons.build_rounded;
    if (code.startsWith('AG_') || code == 'PV_DISPONIBLE') return Icons.how_to_vote_rounded;
    if (code.startsWith('APPEL_') || code.startsWith('IMPAYE_') || code == 'PAIEMENT_RECU') return Icons.payments_rounded;
    if (code.startsWith('RESERVATION_')) return Icons.calendar_month_rounded;
    if (code.startsWith('DOCUMENT_')) return Icons.description_rounded;
    if (code.startsWith('DEPENSE_') || code == 'FACTURE_ECHEANCE_PROCHE') return Icons.receipt_long_rounded;
    if (code.startsWith('JUSTIFICATIF_') || code == 'PAIEMENT_VALIDE' || code == 'PAIEMENT_ESPECES_SAISI') return Icons.verified_rounded;
    return Icons.notifications_rounded;
  }
}

/// Ligne de notification Wise : pastille 48 (teintée si non lue), titre gras si non lu, extrait
/// ardoise, canal + heure, point vert profond en fin de ligne.
class _NotifRow extends StatelessWidget {
  const _NotifRow({required this.n, required this.icon, required this.meta, required this.onTap});
  final NotificationItem n;
  final IconData icon;
  final String meta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final nonLue = !n.lu;
    return SuPressable(
      scale: 0.985,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 11),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconCircle(icon, tone: nonLue ? Tone.sage : Tone.neutral),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(n.titre ?? n.templateCode, style: t.titleMedium?.copyWith(fontWeight: nonLue ? FontWeight.w700 : FontWeight.w500, color: nonLue ? SuColors.ink : SuColors.body), maxLines: 2, overflow: TextOverflow.ellipsis),
                    if (n.corps != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(n.corps!, style: t.bodyMedium?.copyWith(fontSize: 14, color: SuColors.soft, height: 1.35), maxLines: 3, overflow: TextOverflow.ellipsis)),
                    Padding(padding: const EdgeInsets.only(top: 4), child: Text(meta, style: t.bodySmall?.copyWith(color: nonLue ? SuColors.link : SuColors.faint, fontWeight: nonLue ? FontWeight.w600 : null))),
                  ],
                ),
              ),
              if (nonLue)
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 10, top: 6),
                  child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: SuColors.link, shape: BoxShape.circle)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
