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
import '../../core/util/deferred_commit.dart';
import '../../core/util/notifications_link.dart';
import '../../core/util/status.dart';
import '../../core/widgets/widgets.dart';

/// I2 — centre de notifications : titre/corps rendus dans MA langue, lu/non-lu, deep-link.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> with WidgetsBindingObserver {
  bool _nonLues = false;

  /// « Marquer comme lu » / « Tout marquer comme lu » : UI tout de suite, requête DIFFÉRÉE (~6 s,
  /// durée du toast « Annuler »). La ligne `notification` est append-only (Master Spec 7.2) : pas
  /// de « non lu » serveur, l'annulation ne peut être que côté client. Ce qui attend part au
  /// dispose et quand l'app passe en arrière-plan — rien n'est perdu.
  late final EnvoiDiffere<String> _differe = EnvoiDiffere<String>(_envoyerLot);

  /// Conteneur capturé : l'envoi différé doit aboutir même après le dispose de l'écran.
  ProviderContainer? _container;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _container = ProviderScope.containerOf(context, listen: false);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Pas `inactive` (centre de contrôle, appel entrant, sélecteur d'apps) : l'utilisateur est
    // encore là et peut toucher « Annuler ».
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden || state == AppLifecycleState.detached) {
      _differe.vider();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _differe.vider();
    super.dispose();
  }

  bool _lu(NotificationItem n) => n.lu || _differe.enAttente(n.id);

  /// Envoi effectif d'un lot échu / vidé. Le compteur ne baisse que pour les lectures que le
  /// serveur a bien enregistrées ; un échec remet la ligne en « non lue » (elle n'est plus en
  /// attente) et le signale.
  Future<void> _envoyerLot(List<String> ids) async {
    final container = _container;
    if (container == null) return;
    final api = container.read(apiClientProvider);
    final res = await Future.wait([for (final id in ids) api.patch<dynamic>('/notifications/$id/read')]);
    final live = container.read(notificationsLiveProvider.notifier);
    for (final r in res) {
      if (r is ApiOk) live.decrement();
    }
    container.invalidate(notificationsProvider);
    final echecs = res.whereType<ApiFail<dynamic>>().toList();
    if (!mounted) return;
    setState(() {});
    if (echecs.isNotEmpty) {
      echecs.length == 1 && res.length == 1 ? showApiError(context, echecs.first) : showToast(context, context.mdict.ux.markAllFailed, error: true);
    }
  }

  /// Ouvrir une notification = lue IMMÉDIATEMENT (on navigue, pas d'annulation).
  Future<void> _lire(NotificationItem n) async {
    final enAttente = _differe.enAttente(n.id);
    _differe.retirer(n.id);
    if (!n.lu || enAttente) {
      final r = await ref.read(apiClientProvider).patch<dynamic>('/notifications/${n.id}/read');
      if (!mounted) return;
      // Le compteur ne baisse que si le serveur a bien enregistré la lecture.
      if (r is ApiOk) ref.read(notificationsLiveProvider.notifier).decrement();
      ref.invalidate(notificationsProvider);
    }
  }

  /// Marquage différé d'un ou plusieurs ids + toast « Annuler » (qui restaure l'UI sans requête).
  void _marquerDiffere(List<NotificationItem> items) {
    final ids = [for (final x in items) if (!_lu(x)) x.id];
    final lot = _differe.programmer(ids);
    if (lot == null) return;
    setState(() {});
    final ux = context.mdict.ux;
    final n = ids.length;
    showDone(context, n == 1 ? ux.notifLue : fill(ux.notifsLues, {'n': n}), undoLabel: ux.undo, onUndo: () {
      if (!mounted) return;
      if (_differe.annuler(lot) != null) {
        setState(() {});
      } else {
        // Le lot est déjà parti (expiration / arrière-plan) : rien à annuler, on le dit.
        showToast(context, context.mdict.ux.dejaEnregistre);
      }
    });
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
          onPressed: (notifs.valueOrNull ?? const <NotificationItem>[]).any((x) => !_lu(x)) ? () => _marquerDiffere(notifs.valueOrNull ?? const <NotificationItem>[]) : null,
        ),
      ],
      children: [
        Segmented<bool>(value: _nonLues, options: const [false, true], labelOf: (v) => v ? fill(d.notifs.nonLues, {'n': (notifs.valueOrNull ?? const <NotificationItem>[]).where((x) => !_lu(x)).length}) : '${d.common.all} · ${notifs.valueOrNull?.length ?? 0}', onChanged: (v) => setState(() => _nonLues = v)),
        const SizedBox(height: 4),
        AsyncView(
          notifs,
          onRetry: () => ref.invalidate(notificationsProvider),
          data:
              (list) => SuFadeSwitch(
                value: _nonLues,
                child: Builder(
                  builder: (context) {
                    final visible = list.where((n) => !_nonLues || !_lu(n)).toList()..sort((a, b) => b.horodatageEnvoi.compareTo(a.horodatageEnvoi));
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
                                enabled: !_lu(n),
                                // Balayage = marquage DIFFÉRÉ avec « Annuler » ; toucher = ouvrir (lu tout de suite).
                                onAction: () async => _marquerDiffere([n]),
                                icon: Icons.done_all_rounded,
                                label: d.notifs.marquerLu,
                                child: _NotifRow(
                                  key: ValueKey('row-${n.id}'),
                                  n: n,
                                  lu: _lu(n),
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
  const _NotifRow({super.key, required this.n, required this.lu, required this.icon, required this.meta, required this.onTap});
  final NotificationItem n;

  /// Lu côté serveur OU marquage différé en attente (affichage optimiste).
  final bool lu;
  final IconData icon;
  final String meta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final nonLue = !lu;
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
