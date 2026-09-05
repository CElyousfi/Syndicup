import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/push/push_service.dart';
import '../../core/realtime/notifications_live.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/nav.dart';
import '../../core/util/notifications_link.dart';
import '../../core/widgets/widgets.dart';
import '../../offline/sync_queue/visites_sync.dart';

/// Coque applicative mobile : barre de titre compacte (copropriété + cloche), barre d'onglets
/// fixe (4 destinations par rôle + « Plus »), menu complet en feuille du bas. Le pouce fait
/// tout depuis le bas de l'écran (parité avec la coque mobile du web, M12).
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  StreamSubscription<LiveEvent>? _sub;

  @override
  void initState() {
    super.initState();
    // Flux temps réel : toast + invalidation ciblée des lectures concernées.
    _sub = ref.read(notificationsLiveProvider.notifier).events.listen(_onLive);
    // Push : jeton d'appareil enregistré côté API (no-op si Firebase absent du build).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = ref.read(appContextProvider);
      PushService.instance.onOpen = (p) => GoRouter.of(context).push(p);
      PushService.instance.registerToken(ref.read(apiClientProvider), langue: ctx.profil.languePreferee);
      // Le gardien rejoue sa file de visites dès l'ouverture et met en cache les lots
      // (formulaire visiteur utilisable hors-ligne).
      if (ctx.isGardien || ctx.isSyndic) {
        final sync = ref.read(visitesSyncProvider.notifier);
        sync.flush();
        ref.read(lotsProvider.future).then((lots) => sync.cacheLots(lots)).catchError((_) {});
      }
    });
  }

  /// Retour du réseau : les lectures tombées en erreur hors-ligne sont relancées.
  void _onReconnect() {
    for (final p in [visitesProvider, incidentsProvider, lotsProvider, syntheseProvider, notificationsProvider, agListProvider, reservationsProvider, documentsProvider]) {
      ref.invalidate(p);
    }
  }

  void _onLive(LiveEvent e) {
    ref.invalidate(notificationsProvider);
    final t = e.templateCode;
    if (t.startsWith('VISITE_')) ref.invalidate(visitesProvider);
    if (t.startsWith('INCIDENT_')) ref.invalidate(incidentsProvider);
    if (t.startsWith('AG_') || t == 'PV_DISPONIBLE') ref.invalidate(agListProvider);
    if (t.startsWith('RESERVATION_')) ref.invalidate(reservationsProvider);
    if (t.startsWith('APPEL_') || t.startsWith('IMPAYE_') || t == 'PAIEMENT_RECU') ref.invalidate(syntheseProvider);
    if (t.startsWith('DEPENSE_') || t == 'FACTURE_ECHEANCE_PROCHE') ref.invalidate(depensesProvider);
    if (!mounted) return;
    final path = lienNotification(e.templateCode, e.contenuJson);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        duration: const Duration(seconds: 6),
        content: Text(e.titre ?? context.mdict.newNotification, maxLines: 2, overflow: TextOverflow.ellipsis),
        action: SnackBarAction(label: context.mdict.open, textColor: SuColors.blue600, onPressed: () => GoRouter.of(context).push(path)),
      ));
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<bool>>(connectivityProvider, (prev, next) {
      if (prev?.valueOrNull == false && next.valueOrNull == true) _onReconnect();
    });
    final ctx = ref.watch(appContextProvider);
    final dict = ref.watch(dictProvider);
    final nav = buildNav(ctx, dict);
    final tabs = buildTabs(nav, ctx, dict);
    final location = GoRouterState.of(context).uri.path;
    int current = tabs.indexWhere((t) => t.exact ? location == t.path : location == t.path || location.startsWith('${t.path}/'));
    final onPlus = location == '/plus';
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: _TabBar(
        tabs: tabs,
        current: onPlus ? tabs.length : current,
        plusLabel: dict.nav.plus,
        onTap: (i) {
          if (i == tabs.length) {
            _openMenu(context, ctx, nav, dict);
          } else {
            context.go(tabs[i].path);
          }
        },
      ),
    );
  }

  void _openMenu(BuildContext context, AppContext ctx, List<NavSection> nav, Dict dict) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheet) => _MenuSheet(ctx: ctx, nav: nav, dict: dict),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.tabs, required this.current, required this.onTap, required this.plusLabel});
  final List<NavItem> tabs;
  final int current;
  final ValueChanged<int> onTap;
  final String plusLabel;

  @override
  Widget build(BuildContext context) {
    final items = [...tabs.map((t) => (t.label, navIcon(t.icon))), (plusLabel, Icons.menu_rounded)];
    return Container(
      decoration: const BoxDecoration(color: SuColors.surface, border: Border(top: BorderSide(color: SuColors.hairline))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 66,
          child: Row(
            children: [
              for (int i = 0; i < items.length; i++)
                Expanded(
                  child: InkWell(
                    onTap: () => onTap(i),
                    child: Semantics(
                      selected: i == current,
                      button: true,
                      label: items[i].$1,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 8, bottom: 4),
                        child: Column(
                          children: [
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: 52,
                              height: 30,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: i == current ? SuColors.ink : Colors.transparent, borderRadius: BorderRadius.circular(999)),
                              child: Icon(items[i].$2, size: 20, color: i == current ? SuColors.sage : SuColors.soft),
                            ),
                            const SizedBox(height: 4),
                            Text(items[i].$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: i == current ? SuColors.ink : SuColors.soft)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuSheet extends ConsumerWidget {
  const _MenuSheet({required this.ctx, required this.nav, required this.dict});
  final AppContext ctx;
  final List<NavSection> nav;
  final Dict dict;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Theme.of(context).textTheme;
    final live = ref.watch(notificationsLiveProvider);
    final nom = nomCompletProfil(ctx) ?? ctx.profil.email ?? '—';
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Row(
            children: [
              Expanded(child: Text(dict.nav.menu, style: t.titleLarge?.copyWith(fontSize: 17))),
              Material(
                color: SuColors.surface,
                shape: const CircleBorder(),
                child: InkWell(customBorder: const CircleBorder(), onTap: () => Navigator.pop(context), child: const SizedBox(width: 36, height: 36, child: Icon(Icons.close_rounded, size: 18, color: SuColors.text))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (ctx.copropriete != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: SuColors.actionWash, borderRadius: BorderRadius.circular(SuRadius.row)),
              child: Row(
                children: [
                  const IconCircle(Icons.apartment_rounded, tone: Tone.sage, size: 36, iconSize: 20),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(ctx.copropriete!.nom, style: t.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis), Text(ctx.copropriete!.ville, style: t.labelSmall)])),
                  if (ctx.multiCopro) TextButton(onPressed: () {
                    Navigator.pop(context);
                    context.push('/choisir-copropriete');
                  }, style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 6), minimumSize: const Size(0, 32)), child: Text(dict.a11y.switchCopro, style: const TextStyle(fontSize: 12))),
                ],
              ),
            ),
          const SizedBox(height: 8),
          _MenuTile(
            icon: Icons.notifications_rounded,
            label: dict.nav.notifications,
            badge: live.unread,
            onTap: () {
              Navigator.pop(context);
              context.push('/notifications');
            },
          ),
          for (final s in nav) ...[
            if (s.label != null) Padding(padding: const EdgeInsets.fromLTRB(4, 16, 4, 6), child: Text(s.label!.toUpperCase(), style: t.labelSmall)),
            for (final it in s.items)
              _MenuTile(icon: navIcon(it.icon), label: it.label, onTap: () {
                Navigator.pop(context);
                context.go(it.path);
              }),
          ],
          const Padding(padding: EdgeInsets.fromLTRB(0, 12, 0, 8), child: Divider()),
          Row(
            children: [
              Avatar(nom, size: 36, solid: true),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(nom, style: t.titleSmall?.copyWith(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis), Text(dict.roles[ctx.role] ?? ctx.role, style: t.labelSmall)])),
            ],
          ),
          const SizedBox(height: 4),
          _MenuTile(icon: Icons.person_rounded, label: dict.nav.profil, onTap: () {
            Navigator.pop(context);
            context.push('/profil');
          }),
          _MenuTile(icon: Icons.shield_outlined, label: dict.profil.donnees, onTap: () {
            Navigator.pop(context);
            context.push('/profil/donnees');
          }),
          _MenuTile(
            icon: Icons.logout_rounded,
            label: dict.common.logout,
            color: SuColors.danger,
            onTap: () async {
              Navigator.pop(context);
              final api = ref.read(apiClientProvider);
              await PushService.instance.unregisterToken(api);
              await ref.read(sessionProvider.notifier).signOut();
            },
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.icon, required this.label, required this.onTap, this.badge = 0, this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badge;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, size: 20, color: color ?? SuColors.blue600),
      title: Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: color ?? SuColors.text)),
      trailing: badge > 0 ? _CountBadge(badge) : null,
      minTileHeight: 44,
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SuRadius.pill)),
      selectedTileColor: SuColors.actionWash,
      onTap: onTap,
    );
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge(this.n);
  final int n;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(color: SuColors.danger, borderRadius: BorderRadius.circular(999)),
        child: Text(n > 99 ? '99+' : '$n', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
      );
}

String? nomCompletProfil(AppContext ctx) {
  final s = [ctx.profil.prenom, ctx.profil.nom].whereType<String>().where((x) => x.isNotEmpty).join(' ');
  return s.isEmpty ? null : s;
}

/// Barre de titre d'un écran racine d'onglet : copropriété + cloche (compteur live) + avatar.
class ShellHeader extends ConsumerWidget implements PreferredSizeWidget {
  const ShellHeader({super.key, this.title});
  final String? title;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final live = ref.watch(notificationsLiveProvider);
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final t = Theme.of(context).textTheme;
    final md = context.mdict;
    return AppBar(
      automaticallyImplyLeading: false,
      titleSpacing: 16,
      title: Row(
        children: [
          _CoproMark(ctx: ctx),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title ?? ctx.copropriete?.nom ?? 'SyndicUp', style: t.titleMedium?.copyWith(fontSize: 15, height: 1.2), maxLines: 1, overflow: TextOverflow.ellipsis),
                Row(
                  children: [
                    if (!online) ...[
                      Container(width: 7, height: 7, decoration: const BoxDecoration(color: SuColors.warn, shape: BoxShape.circle)),
                      const SizedBox(width: 5),
                      Text(md.offline, style: t.bodySmall?.copyWith(color: SuColors.amber600)),
                    ] else
                      Text(ctx.copropriete?.ville ?? '', style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        Semantics(
          label: ref.watch(dictProvider).a11y.notifications,
          button: true,
          child: IconButton(
            onPressed: () => context.push('/notifications'),
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_rounded, size: 26, color: SuColors.blue600),
                if (live.unread > 0)
                  PositionedDirectional(
                    end: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(color: SuColors.danger, borderRadius: BorderRadius.circular(999)),
                      child: Text(live.unread > 9 ? '9+' : '${live.unread}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsetsDirectional.only(end: 12),
          child: GestureDetector(onTap: () => context.push('/profil'), child: Avatar(nomCompletProfil(ctx) ?? ctx.profil.email ?? '?', size: 44)),
        ),
      ],
    );
  }
}

class _CoproMark extends ConsumerWidget {
  const _CoproMark({required this.ctx});
  final AppContext ctx;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copro = ctx.copropriete;
    if (copro?.logoStoragePath != null) {
      final url = ref.watch(logoUrlProvider(copro!.id)).valueOrNull;
      if (url != null) {
        return ClipOval(child: Image.network(url, width: 44, height: 44, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const _Mark()));
      }
    }
    return const _Mark();
  }
}

class _Mark extends StatelessWidget {
  const _Mark();
  @override
  Widget build(BuildContext context) => ClipOval(child: Image.asset('assets/images/logo.png', width: 44, height: 44, fit: BoxFit.cover));
}
