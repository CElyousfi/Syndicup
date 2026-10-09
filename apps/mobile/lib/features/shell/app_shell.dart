import 'dart:math' as math;
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/providers.dart';
import '../../core/auth/app_state.dart';
import '../../core/auth/session.dart';
import '../../core/feel/feel.dart';
import '../../core/i18n/i18n.dart';
import '../../core/i18n/mobile_dict.dart';
import '../../core/push/niveaux.dart';
import '../../core/push/push_service.dart';
import '../../core/realtime/notifications_live.dart';
import '../../core/theme/tokens.dart';
import '../../core/util/nav.dart';
import '../../core/util/notifications_link.dart';
import '../../core/widgets/widgets.dart';
import '../../offline/sync_queue/visites_sync.dart';
import '../../core/theme/motion.dart';

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
  /// Positions de défilement des écrans d'onglet (vit aussi longtemps que la session).
  final PageStorageBucket _tabScroll = PageStorageBucket();

  /// Retour du réseau : « Connexion rétablie » quelques secondes, puis le bandeau se replie.
  bool _justBack = false;
  Timer? _backTimer;
  DateTime? _pausedAt;
  late final AppLifecycleListener _life = AppLifecycleListener(
    onPause: () => _pausedAt = DateTime.now(),
    onResume: () {
      // Retour au premier plan après ≥ 30 s : les données se mettent à jour en douceur (contenu
      // gardé à l'écran, montants qui roulent, lignes qui entrent) — jamais d'écran blanc.
      final p = _pausedAt;
      _pausedAt = null;
      if (p != null && DateTime.now().difference(p) >= const Duration(seconds: 30)) _refreshVisible();
    },
  );

  @override
  void initState() {
    super.initState();
    _life;
    SuPage.rootHeader = () => const ShellHeader();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      LaunchHandoff.play(context);
      // Moment signature 7 : première connexion de cet utilisateur sur cet appareil — le logo et
      // « Bienvenue sur SyndicUp », une seule fois, après le relais du lancement.
      final uid = ref.read(appContextProvider).profil.id;
      Future<void>.delayed(const Duration(milliseconds: 750), () {
        if (mounted) SuSignature.welcomeOnce(context, userKey: uid);
      });
    });
    // Flux temps réel : toast + invalidation ciblée des lectures concernées.
    _sub = ref.read(notificationsLiveProvider.notifier).events.listen(_onLive);
    // Push : jeton d'appareil enregistré côté API (no-op si Firebase absent du build).
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final ctx = ref.read(appContextProvider);
      final push = PushService.instance;
      push.onOpen = (p) => GoRouter.of(context).push(p);
      // Action « Marquer comme lu » depuis la notification système.
      push.onMarquerLu = (id) async {
        await ref.read(apiClientProvider).patch<dynamic>('/notifications/$id/read');
        ref.read(notificationsLiveProvider.notifier).decrement();
        ref.invalidate(notificationsProvider);
      };
      // Permission système (Android 13+, iOS) demandée une fois connecté — contexte explicite.
      await push.demanderPermission();
      // Notification qui a lancé l'app (app fermée) : on ouvre l'objet concerné.
      final initial = push.prendreCheminInitial();
      if (initial != null && mounted) GoRouter.of(context).push(initial);
      // Membre de cabinet sans rôle de copropriété (M25) : pas d'enregistrement push tenant.
      if (!ctx.isMembreCabinetSeul) PushService.instance.registerToken(ref.read(apiClientProvider), langue: ctx.profil.languePreferee);
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
    _refreshVisible();
    setState(() => _justBack = true);
    _backTimer?.cancel();
    _backTimer = Timer(const Duration(milliseconds: 2600), () {
      if (mounted) setState(() => _justBack = false);
    });
  }

  void _refreshVisible() {
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
    if (t.startsWith('JUSTIFICATIF_') || t == 'PAIEMENT_VALIDE' || t == 'PAIEMENT_ESPECES_SAISI') ref.invalidate(justificatifsProvider);
    if (t.startsWith('CONTRAT_') || t == 'ASSURANCE_IMMEUBLE_ABSENTE') {
      ref.invalidate(contratsProvider);
      ref.invalidate(assuranceProvider);
    }
    if (t.startsWith('TACHE')) {
      ref.invalidate(mesTachesProvider);
      ref.invalidate(tachesProvider);
    }
    if (t == 'IMPORT_TERMINE' || t == 'INVITATION_ACCEPTEE') ref.invalidate(onboardingProvider);
    if (t.startsWith('MANDAT_')) { ref.invalidate(cabinetsProvider); ref.invalidate(appContextProvider); }
    if (t.startsWith('ATTRIBUTION_') || t.startsWith('BADGE_') || t == 'VISITEUR_DEPASSEMENT') {
      ref.invalidate(planEmplacementsProvider);
      ref.invalidate(attributionsProvider);
      ref.invalidate(badgesProvider);
      ref.invalidate(visiteursAujourdhuiProvider);
    }
    if (t.startsWith('ANNONCE_') || t.startsWith('SONDAGE_') || t == 'COMMUNICATION_DIGEST') {
      ref.invalidate(annoncesProvider);
      ref.invalidate(annoncesNonLuesProvider);
      ref.invalidate(sondagesProvider);
    }
    if (t.startsWith('CONGE_') || t.startsWith('PAIE_') || t == 'CONTRAT_TRAVAIL_FIN_PROCHE') {
      ref.invalidate(personnelProvider);
      ref.invalidate(congesEnAttenteProvider);
    }
    if (t.startsWith('RAPPORT_GESTION_')) {
      ref.invalidate(rapportsGestionProvider);
      ref.invalidate(transparenceProvider);
    }
    if (!mounted) return;
    final path = lienNotification(e.templateCode, e.contenuJson);
    // Bannière / alerte système : toujours pour URGENT (heads-up même app ouverte), sinon quand
    // l'app n'est pas au premier plan (arrière-plan récent, écran verrouillé). Sans Firebase,
    // c'est ce chemin qui porte les notifications du téléphone.
    final push = PushService.instance;
    final niveau = niveauPour(e.niveau, e.templateCode);
    if (e.livrer && (niveau == niveauUrgent || !push.enAvantPlan)) {
      push.afficher(cle: e.id, titre: e.titre, corps: e.corps, niveau: niveau, fil: filPour(e.fil, e.templateCode), badge: e.unread, son: e.son, path: path, notificationId: e.id);
    }
    if (!push.enAvantPlan) return;
    // App ouverte : toast vivant (action « Ouvrir ») + tintement discret — les données concernées
    // se mettent à jour d'elles-mêmes à l'écran (invalidations ci-dessus, montants qui roulent).
    Sounds.play(SuSound.notify);
    SuToaster.show(context, e.titre ?? context.mdict.newNotification, duration: const Duration(seconds: 6), actionLabel: context.mdict.open, onAction: () => GoRouter.of(context).push(path));
  }

  @override
  void dispose() {
    _sub?.cancel();
    _backTimer?.cancel();
    _life.dispose();
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
    final quick = quickActions(ctx, nav, dict);
    // Wise : 4 destinations + bouton d'action central. Avec un bouton central, 3 onglets
    // (l'onglet retiré reste dans « Plus » et dans les actions rapides).
    final md = context.mdict;
    // Libellés courts (le tableau d'affichage n'en a pas dans le dictionnaire web).
    final tabs = buildTabs(nav, ctx, dict).take(quick.isEmpty ? 4 : 3).map((t) => t.icon == 'megaphone' ? NavItem(t.path, md.tabAffichage, t.icon, exact: t.exact) : t).toList();
    final location = GoRouterState.of(context).uri.path;
    int current = tabs.indexWhere((t) => t.exact ? location == t.path : location == t.path || location.startsWith('${t.path}/'));
    final onPlus = location == '/plus';
    // Bandeau de connexion calme : hors ligne → se déplie ; retour → « Connexion rétablie ».
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final a = dict.alive;
    final banner = !Feel.alive
        ? null
        : !online
            ? a.horsLigne
            : _justBack
                ? a.enLigne
                : null;
    return Scaffold(
      body: Column(
        children: [
          SuStatusBanner(message: banner, tone: online ? BannerTone.ok : BannerTone.warn, topInset: MediaQuery.paddingOf(context).top),
          Expanded(child: MediaQuery.removePadding(context: context, removeTop: banner != null, child: TabScrollMemory(bucket: _tabScroll, child: widget.child))),
        ],
      ),
      bottomNavigationBar: _TabBar(
        tabs: tabs,
        current: onPlus ? tabs.length : current,
        plusLabel: dict.nav.plus,
        actionLabel: quick.isEmpty ? null : context.mdict.tabAction,
        onAction: () => _openQuick(context, quick),
        onTap: (i) {
          if (i != (onPlus ? tabs.length : current) && i != tabs.length) Haptics.select();
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
    Haptics.select();
    showSuSheet<void>(context, showDragHandle: false, builder: (sheet) => _MenuSheet(ctx: ctx, nav: nav, dict: dict));
  }

  void _openQuick(BuildContext context, List<QuickAction> actions) {
    Haptics.tap();
    showSuSheet<void>(context, showDragHandle: false, builder: (sheet) => _QuickSheet(actions: actions));
  }
}

/// Action rapide du bouton central (rôle « Send » de Wise).
class QuickAction {
  const QuickAction(this.icon, this.label, this.path, {this.hint, this.tone = Tone.sage, this.art});
  final IconData icon;
  /// Pictogramme 2D (`quick-…`).
  final String? art;
  final String label;
  final String path;
  final String? hint;
  final Tone tone;
}

/// Actions rapides par rôle — uniquement vers des écrans que la navigation du rôle expose déjà
/// (le préfixe de chaque chemin doit figurer dans `nav`) : le bouton central n'ouvre jamais un
/// écran que l'API refuserait.
List<QuickAction> quickActions(AppContext ctx, List<NavSection> nav, Dict d) {
  final paths = nav.expand((s) => s.items).map((i) => i.path).toSet();
  bool has(String p) => paths.any((x) => x == p || p.startsWith('$x/'));
  final role = ctx.role;
  final gestion = role == 'SYNDIC' || role == 'SYNDIC_COMPTABLE';
  final all = <QuickAction>[
    if (role == 'SUPER_ADMIN') QuickAction(Icons.add_business_rounded, d.admin.creer, '/admin/coproprietes/nouvelle', tone: Tone.sage, art: 'quick-copropriete'),
    if (role == 'GARDIEN') QuickAction(Icons.meeting_room_rounded, d.dash.enregistrerVisiteur, '/visites?enregistrer=1', tone: Tone.sage, art: 'quick-visiteur'),
    if (gestion) QuickAction(Icons.payments_rounded, d.finances.enregistrerPaiement, '/finances/appels-de-fonds', tone: Tone.sage, art: 'quick-paiement'),
    if (gestion) QuickAction(Icons.request_quote_rounded, d.dash.genererAppel, '/finances/appels-de-fonds?generer=1', tone: Tone.sand, art: 'quick-appel'),
    if (role == 'SYNDIC') QuickAction(Icons.vpn_key_rounded, d.dash.inviterResident, '/invitations?nouvelle=1', tone: Tone.lilac, art: 'quick-invitation'),
    if (ctx.isResident && role != 'LOCATAIRE' && role != 'GESTIONNAIRE_LCD') QuickAction(Icons.account_balance_rounded, d.justificatifs.payerTitre, '/payer', tone: Tone.sage, art: 'quick-payer'),
    if (role != 'SUPER_ADMIN' && role != 'PRESTATAIRE' && role != 'MEMBRE_CABINET') QuickAction(Icons.build_rounded, d.dash.signalerIncident, '/incidents/nouveau', tone: Tone.sand, art: 'quick-incident'),
    if (ctx.declareSejoursLcd) QuickAction(Icons.luggage_rounded, d.lcd.declarerSejour, '/location-courte-duree/sejours/nouveau', tone: Tone.tosca, art: 'quick-sejour'),
    if (ctx.isResident || role == 'CONSEIL_SYNDICAL') QuickAction(Icons.event_available_rounded, d.espaces.reserver, '/espaces-communs', tone: Tone.lilac, art: 'quick-reservation'),
    if (role == 'SYNDIC') QuickAction(Icons.how_to_vote_rounded, d.dash.creerAg, '/ag/nouvelle', tone: Tone.tosca, art: 'quick-ag'),
  ];
  return all.where((a) => has(a.path.split('?').first)).toList();
}

class _QuickSheet extends StatelessWidget {
  const _QuickSheet({required this.actions});
  final List<QuickAction> actions;
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(context.mdict.quickTitle, style: t.displaySmall),
            const SizedBox(height: 14),
            CardList([
              for (final a in actions)
                ListRow(
                  leading: a.art == null ? IconCircle(a.icon, tone: a.tone) : SuIllustration(a.art!, size: 48, fallback: IconCircle(a.icon, tone: a.tone)),
                  title: a.label,
                  subtitle: a.hint,
                  chevron: true,
                  onTap: () {
                    Navigator.pop(context);
                    context.push(a.path);
                  },
                ),
            ]),
          ],
        ),
      ),
    );
  }
}

/// Barre d'onglets Wise : fond blanc, filet supérieur, icônes trait + libellé ; actif = encre
/// gras ; au centre, un disque sauge surélevé (le bouton « Send » de Wise) ouvre les actions.
class _TabBar extends StatelessWidget {
  const _TabBar({required this.tabs, required this.current, required this.onTap, required this.plusLabel, this.actionLabel, this.onAction});
  final List<NavItem> tabs;
  final int current;
  final ValueChanged<int> onTap;
  final String plusLabel;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final items = [...tabs.map((t) => (t.label, navIcon(t.icon))), (plusLabel, Icons.apps_rounded)];
    // Position du bouton central : après la moitié des onglets.
    final mid = actionLabel == null ? -1 : (items.length / 2).floor();
    Widget tab(int i) {
      final sel = i == current;
      return Expanded(
        child: SuTap(
          onTap: () => onTap(i),
          scale: SuTokens.pressChip,
          child: Semantics(
            selected: sel,
            button: true,
            label: items[i].$1,
            excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 6),
              child: Column(
                children: [
                  SizedBox(
                    height: 28,
                    child: Center(
                      child: TweenAnimationBuilder<Color?>(
                        tween: ColorTween(end: sel ? SuColors.ink : SuColors.faint),
                        duration: SuMotion.of(context, SuMotion.base),
                        builder: (_, c, __) {
                          final icon = Icon(items[i].$2, size: 25, color: c);
                          if (!sel || SuMotion.reduced(context)) return icon;
                          // Petit rebond de l'icône quand l'onglet devient actif.
                          return icon.animate(key: ValueKey('tab-$i')).scaleXY(begin: 0.72, end: 1, duration: 520.ms, curve: SuMotion.spring);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  AnimatedDefaultTextStyle(
                    duration: SuMotion.of(context, SuMotion.base),
                    // Fusion avec le style hérité (police arabe, hauteurs) — comme l'ancien Text.
                    style: DefaultTextStyle.of(context).style.merge(TextStyle(fontSize: 11.5, fontWeight: sel ? FontWeight.w700 : FontWeight.w500, color: sel ? SuColors.ink : SuColors.soft)),
                    child: Text(items[i].$1, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // Indicateur unique qui GLISSE d'un onglet à l'autre (ressort, sens de lecture respecté) ;
    // l'emplacement du bouton central est sauté.
    final slots = items.length + (mid >= 0 ? 1 : 0);
    final slot = current < 0 ? -1 : (mid >= 0 && current >= mid ? current + 1 : current);
    return Container(
      decoration: const BoxDecoration(color: SuColors.surface, border: Border(top: BorderSide(color: SuColors.hairline))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 76,
          child: Stack(
            children: [
              Row(
                children: [
                  for (int i = 0; i < items.length; i++) ...[
                    if (i == mid) _ActionTab(label: actionLabel!, onTap: onAction!),
                    tab(i),
                  ],
                ],
              ),
              if (Feel.alive && slot >= 0)
                Positioned.fill(
                  child: IgnorePointer(
                    child: AnimatedAlign(
                      alignment: AlignmentDirectional(slots <= 1 ? 0 : -1 + 2 * slot / (slots - 1), -1),
                      duration: SuMotion.of(context, const Duration(milliseconds: 420)),
                      curve: SuMotion.spring,
                      child: FractionallySizedBox(
                        widthFactor: 1 / slots,
                        child: Center(child: Container(width: 26, height: 3, decoration: BoxDecoration(color: SuColors.brand, borderRadius: BorderRadius.circular(99)))),
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

/// Bouton central Wise : disque sauge 52 px au glyphe encre, libellé dessous.
class _ActionTab extends StatelessWidget {
  const _ActionTab({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: SuTap(
          ink: false,
          scale: 1,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.only(top: 3, bottom: 4),
            child: Column(
              children: [
                SuPressable(
                  scale: 0.88,
                  child: Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(color: SuColors.cta, shape: BoxShape.circle),
                    child: const Icon(Icons.add_rounded, size: 30, color: SuColors.onCta),
                  ),
                ),
                const SizedBox(height: 2),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: DefaultTextStyle.of(context).style.merge(const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: SuColors.soft))),
              ],
            ),
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
              Expanded(child: Text(dict.nav.menu, style: t.displaySmall)),
              CircleIconButton(icon: Icons.close_rounded, onTap: () => Navigator.pop(context), tooltip: MaterialLocalizations.of(context).closeButtonTooltip),
            ],
          ),
          const SizedBox(height: 16),
          if (ctx.copropriete != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              decoration: BoxDecoration(color: SuColors.tile, borderRadius: BorderRadius.circular(SuRadius.card)),
              child: Row(
                children: [
                  const IconCircle(Icons.apartment_rounded, tone: Tone.sage, size: 44, iconSize: 22),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(ctx.copropriete?.nom ?? dict.nav.cabinet, style: t.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis), Text(ctx.copropriete?.ville ?? (dict.roles[ctx.role] ?? ctx.role), style: t.labelSmall)])),
                  if (ctx.multiCopro)
                    LinkButton(dict.a11y.switchCopro, onTap: () {
                      Navigator.pop(context);
                      context.push('/choisir-copropriete');
                    }),
                ],
              ),
            ),
          const SizedBox(height: 8),
          // Les notifications sont par copropriété : absentes en mode « cabinet seul » (M25).
          if (!ctx.isMembreCabinetSeul)
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
            if (s.label != null) Padding(padding: const EdgeInsets.fromLTRB(4, 22, 4, 6), child: Text(s.label!, style: t.bodyMedium?.copyWith(color: SuColors.soft))),
            for (final it in s.items)
              _MenuTile(icon: navIcon(it.icon), label: it.label, onTap: () {
                Navigator.pop(context);
                context.go(it.path);
              }),
          ],
          const Padding(padding: EdgeInsets.fromLTRB(0, 12, 0, 8), child: Divider()),
          Row(
            children: [
              Avatar(nom, size: 44, tinted: false),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(nom, style: t.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis), Text(dict.roles[ctx.role] ?? ctx.role, style: t.labelSmall)])),
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
    // Rangée « Manage » de Wise : pastille ronde, libellé gras, chevron nu.
    return SuTap(
      onTap: onTap,
      scale: SuTokens.pressRow,
      borderRadius: BorderRadius.circular(18),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(color: color == null ? SuColors.wash : SuColors.dangerTint, shape: BoxShape.circle), child: Icon(icon, size: 21, color: color ?? SuColors.ink)),
              const SizedBox(width: 16),
              Expanded(child: Text(label, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: color ?? SuColors.ink))),
              badge > 0 ? _CountBadge(badge) : ChevronEnd(color: color),
            ],
          ),
        ),
      ),
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
        child: Text(n > 99 ? '99+' : '$n', textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
      ).animate(key: ValueKey(n)).scaleXY(begin: SuMotion.reduced(context) ? 1 : 0.4, end: 1, duration: 420.ms, curve: SuMotion.spring);
}

String? nomCompletProfil(AppContext ctx) {
  final s = [ctx.profil.prenom, ctx.profil.nom].whereType<String>().where((x) => x.isNotEmpty).join(' ');
  return s.isEmpty ? null : s;
}

/// En-tête Wise d'un écran racine d'onglet : avatar à gauche (pastille rouge = notifications non
/// lues, comme Wise), pill de la résidence et cloche à droite ; avec `title`, le grand titre gras
/// de l'écran (« Account ») sous la rangée.
class ShellHeader extends ConsumerWidget implements PreferredSizeWidget {
  const ShellHeader({super.key, this.title});
  final String? title;

  @override
  Size get preferredSize => Size.fromHeight(title == null ? 68 : 124);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctx = ref.watch(appContextProvider);
    final live = ref.watch(notificationsLiveProvider);
    final online = ref.watch(connectivityProvider).valueOrNull ?? true;
    final t = Theme.of(context).textTheme;
    final md = context.mdict;
    final dict = ref.watch(dictProvider);
    final nom = nomCompletProfil(ctx) ?? ctx.profil.email ?? '?';
    return Material(
      color: SuColors.surface,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 8, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 52,
                child: Row(
                  children: [
                    // Avatar : ouvre le profil.
                    Semantics(
                      button: true,
                      label: dict.nav.profil,
                      child: SuTap(
                        ink: false,
                        scale: SuTokens.pressIcon,
                        onTap: () => context.push('/profil'),
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Avatar(nom, size: 48, tinted: false),
                            if (live.unread > 0)
                              PositionedDirectional(
                                end: -1,
                                top: -1,
                                child: Container(width: 16, height: 16, decoration: BoxDecoration(color: SuColors.danger, shape: BoxShape.circle, border: Border.all(color: SuColors.surface, width: 2.5)))
                                    .animate(key: ValueKey(live.unread))
                                    .scaleXY(begin: SuMotion.reduced(context) ? 1 : 0.3, end: 1, duration: 420.ms, curve: SuMotion.spring),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const Spacer(),
                    _CoproPill(ctx: ctx, online: online, offlineLabel: md.offline),
                    Semantics(
                      label: dict.a11y.notifications,
                      button: true,
                      child: SuTap(
                        customBorder: const CircleBorder(),
                        scale: SuTokens.pressIcon,
                        onTap: () => context.push('/notifications'),
                        child: Padding(padding: const EdgeInsets.all(10), child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            _RingingBell(count: live.unread),
                            if (live.unread > 0)
                              PositionedDirectional(
                                end: -6,
                                top: -5,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(color: SuColors.danger, borderRadius: BorderRadius.circular(999), border: Border.all(color: SuColors.surface, width: 1.5)),
                                  child: Text(live.unread > 9 ? '9+' : '${live.unread}', textDirection: TextDirection.ltr, style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w700)),
                                ).animate(key: ValueKey(live.unread)).scaleXY(begin: SuMotion.reduced(context) ? 1 : 0.4, end: 1, duration: 420.ms, curve: SuMotion.spring),
                              ),
                          ],
                        )),
                      ),
                    ),
                  ],
                ),
              ),
              if (title != null)
                Padding(
                  padding: const EdgeInsetsDirectional.only(top: 10, end: 8),
                  child: Text(title!, style: t.displayMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pill de la résidence (rôle des pills d'en-tête Wise) : logo + nom ; ouvre le choix de la
/// copropriété quand il y en a plusieurs. Hors-ligne : pastille ambre.
class _CoproPill extends ConsumerWidget {
  const _CoproPill({required this.ctx, required this.online, required this.offlineLabel});
  final AppContext ctx;
  final bool online;
  final String offlineLabel;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nom = ctx.copropriete?.nom ?? 'SyndicUp';
    final pill = Container(
      constraints: const BoxConstraints(maxWidth: 210),
      padding: const EdgeInsetsDirectional.fromSTEB(5, 5, 14, 5),
      decoration: BoxDecoration(color: online ? SuColors.tile : SuColors.warnTint, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(width: 30, height: 30, child: _CoproMark(ctx: ctx)),
          const SizedBox(width: 8),
          Flexible(child: Text(online ? nom : offlineLabel, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: online ? SuColors.ink : SuColors.warn))),
          if (ctx.multiCopro) ...[const SizedBox(width: 4), const Icon(Icons.unfold_more_rounded, size: 18, color: SuColors.link)],
        ],
      ),
    );
    if (!ctx.multiCopro) return pill;
    return SuTap(ink: false, onTap: () => context.push('/choisir-copropriete'), child: pill);
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
        return ClipOval(child: SuImage.network(url, width: 30, height: 30, errorBuilder: (_, __, ___) => const _Mark()));
      }
    }
    return const _Mark();
  }
}

class _Mark extends StatelessWidget {
  const _Mark();
  @override
  Widget build(BuildContext context) => const ClipOval(child: BrandTile(size: 30));
}

/// Cloche qui sonne (oscillation amortie) quand le compteur MONTE — pas au premier affichage.
class _RingingBell extends StatefulWidget {
  const _RingingBell({required this.count});
  final int count;
  @override
  State<_RingingBell> createState() => _RingingBellState();
}

class _RingingBellState extends State<_RingingBell> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));

  @override
  void didUpdateWidget(covariant _RingingBell old) {
    super.didUpdateWidget(old);
    if (widget.count > old.count && !SuMotion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, child) {
          final t = _c.value;
          final angle = t == 0 || t == 1 ? 0.0 : 0.26 * math.sin(t * math.pi * 6) * (1 - t);
          return Transform.rotate(angle: angle, alignment: const Alignment(0, -0.85), child: child);
        },
        child: const Icon(Icons.notifications_none_rounded, size: 27, color: SuColors.link),
      );
}
