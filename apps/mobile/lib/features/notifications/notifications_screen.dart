import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_result.dart';
import '../../core/api/models.dart';
import '../../core/api/refresh.dart';
import '../../core/auth/session.dart';
import '../../core/format/format.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/realtime/notifications_live.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/notifications_link.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';

/// I2 — centre de notifications : titre/corps rendus dans MA langue, lu/non-lu, deep-link.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _nonLues = false;
  bool _toutLire = false;

  Future<void> _lire(NotificationItem n) async {
    if (!n.lu) {
      final r = await ref.read(apiClientProvider).patch<dynamic>('/notifications/${n.id}/read');
      if (!mounted) return;
      // Le compteur ne baisse que si le serveur a bien enregistré la lecture.
      if (r is ApiOk) ref.read(notificationsLiveProvider.notifier).decrement();
      ref.invalidate(notificationsProvider);
    }
  }

  /// « Tout marquer comme lu » : en cours = bouton qui tourne ; le compteur n'est remis à zéro que
  /// si TOUTES les lectures ont été enregistrées ; sinon il reflète ce qui reste non lu.
  Future<void> _toutMarquerLu(List<NotificationItem> list) async {
    if (_toutLire) return;
    final nonLues = list.where((x) => !x.lu).toList();
    if (nonLues.isEmpty) return;
    setState(() => _toutLire = true);
    final api = ref.read(apiClientProvider);
    final res = await Future.wait([for (final n in nonLues) api.patch<dynamic>('/notifications/${n.id}/read')]);
    if (!mounted) return;
    final echecs = res.whereType<ApiFail<dynamic>>().toList();
    final live = ref.read(notificationsLiveProvider.notifier);
    if (echecs.isEmpty) {
      live.setUnread(0);
    } else {
      live.setUnread(echecs.length);
      echecs.length == res.length ? showApiError(context, echecs.first) : showToast(context, context.mdict.ux.markAllFailed, error: true);
    }
    setState(() => _toutLire = false);
    await refreshing(ref, [notificationsProvider]);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.dict;
    final l = context.locale;
    final notifs = ref.watch(notificationsProvider);
    return SuPage(
      title: d.notifs.titre,
      onRefresh: () => refreshing(ref, [notificationsProvider]),
      actions: [
        SuButton(
          variant: SuButtonVariant.ghost,
          label: d.notifs.toutesLues,
          loading: _toutLire,
          onPressed: (notifs.valueOrNull ?? const <NotificationItem>[]).any((x) => !x.lu) ? () => _toutMarquerLu(notifs.valueOrNull ?? const <NotificationItem>[]) : null,
        ),
      ],
      children: [
        Segmented<bool>(value: _nonLues, options: const [false, true], labelOf: (v) => v ? fill(d.notifs.nonLues, {'n': (notifs.valueOrNull ?? const []).where((x) => !x.lu).length}) : '${d.common.all} · ${notifs.valueOrNull?.length ?? 0}', onChanged: (v) => setState(() => _nonLues = v)),
        const SizedBox(height: 4),
        AsyncView(
          notifs,
          onRetry: () => ref.invalidate(notificationsProvider),
          data:
              (list) => SuFadeSwitch(
                value: _nonLues,
                child: Builder(
                  builder: (context) {
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
                              SuSwipeAction(
                                key: ValueKey(n.id),
                                enabled: !n.lu,
                                onAction: () => _lire(n),
                                icon: Icons.done_all_rounded,
                                label: d.notifs.marquerLu,
                                child: _NotifRow(
                                  key: ValueKey('row-${n.id}'),
                                  n: n,
                                  icon: _icon(n.templateCode),
                                  meta: n.statutEnvoi == 'EN_ATTENTE' ? '${formatHeure(n.horodatageEnvoi, l)} · ${fill(d.notifs.envoiEnAttente, {'canal': (d.enums.canal[n.canal] ?? humanizeCode(n.canal)).toLowerCase()})}' : '${d.enums.canal[n.canal] ?? humanizeCode(n.canal)} · ${formatHeure(n.horodatageEnvoi, l)}',
                                  onTap: () {
                                    _lire(n);
                                    context.push(lienNotification(n.templateCode, n.contenuJson));
                                  },
                                ),
                              ),
                          ]),
                        ],
                      ],
                    );
                  },
                ),
              ),
        ),
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
  const _NotifRow({super.key, required this.n, required this.icon, required this.meta, required this.onTap});
  final NotificationItem n;
  final IconData icon;
  final String meta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final nonLue = !n.lu;
    return SuTap(
      scale: 0.985,
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
            if (nonLue) Padding(padding: const EdgeInsetsDirectional.only(start: 10, top: 6), child: Container(width: 10, height: 10, decoration: const BoxDecoration(color: SuColors.link, shape: BoxShape.circle))),
          ],
        ),
      ),
    );
  }
}
