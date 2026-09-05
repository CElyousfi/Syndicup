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
    final t = Theme.of(context).textTheme;
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
        Segmented<bool>(value: _nonLues, options: const [false, true], labelOf: (v) => v ? '${d.notifs.nonLues} · ${(notifs.valueOrNull ?? const []).where((x) => !x.lu).length}' : '${d.common.all} · ${notifs.valueOrNull?.length ?? 0}', onChanged: (v) => setState(() => _nonLues = v)),
        const SizedBox(height: 12),
        AsyncView(notifs, onRetry: () => ref.invalidate(notificationsProvider), data: (list) {
          final visible = list.where((n) => !_nonLues || !n.lu).toList()..sort((a, b) => b.horodatageEnvoi.compareTo(a.horodatageEnvoi));
          if (visible.isEmpty) return EmptyState(title: d.notifs.aucune, hint: d.notifs.aucuneAide, icon: Icons.notifications_none_rounded);
          return CardList([
            for (final n in visible)
              InkWell(
                onTap: () {
                  _lire(n);
                  context.push(lienNotification(n.templateCode, n.contenuJson));
                },
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconCircle(_icon(n.templateCode), tone: n.lu ? Tone.neutral : Tone.action, size: 40),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(n.titre ?? n.templateCode, style: t.titleSmall?.copyWith(fontWeight: n.lu ? FontWeight.w500 : FontWeight.w700)),
                            if (n.corps != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(n.corps!, style: t.bodySmall, maxLines: 3, overflow: TextOverflow.ellipsis)),
                            const SizedBox(height: 4),
                            Text('${d.enums.canal[n.canal] ?? n.canal} · ${formatDateHeure(n.horodatageEnvoi, l)}${n.statutEnvoi == 'EN_ATTENTE' ? ' · ${d.notifs.envoiEnAttente}' : ''}', style: t.labelSmall),
                          ],
                        ),
                      ),
                      if (!n.lu) Container(width: 9, height: 9, margin: const EdgeInsets.only(top: 6), decoration: const BoxDecoration(color: SuColors.action, shape: BoxShape.circle)),
                    ],
                  ),
                ),
              ),
          ]);
        }),
      ],
    );
  }

  IconData _icon(String code) {
    if (code.startsWith('VISITE_')) return Icons.meeting_room_rounded;
    if (code.startsWith('INCIDENT_')) return Icons.build_rounded;
    if (code.startsWith('AG_') || code == 'PV_DISPONIBLE') return Icons.how_to_vote_rounded;
    if (code.startsWith('APPEL_') || code.startsWith('IMPAYE_') || code == 'PAIEMENT_RECU') return Icons.payments_rounded;
    if (code.startsWith('RESERVATION_')) return Icons.calendar_month_rounded;
    if (code.startsWith('DOCUMENT_')) return Icons.description_rounded;
    if (code.startsWith('DEPENSE_') || code == 'FACTURE_ECHEANCE_PROCHE') return Icons.receipt_long_rounded;
    return Icons.notifications_rounded;
  }
}
