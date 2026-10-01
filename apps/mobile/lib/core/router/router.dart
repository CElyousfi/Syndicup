import 'dart:typed_data';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/admin/admin_screens.dart';
import '../../features/ag/ag_screens.dart';
import '../../features/ag/ag_seance_screen.dart';
import '../../features/auth/invitation_screens.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/welcome_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/depenses/depenses_screens.dart';
import '../../features/justificatifs/justificatifs_screens.dart';
import '../../features/rapports/rapports_screens.dart';
import '../../features/contrats/contrats_screens.dart';
import '../../features/documents/document_viewer_screen.dart';
import '../../features/documents/documents_screen.dart';
import '../../features/espaces/espaces_screens.dart';
import '../../features/finances/finances_screens.dart';
import '../../features/incidents/incidents_screens.dart';
import '../../features/invitations/invitations_screen.dart';
import '../../features/lcd/lcd_screens.dart';
import '../../features/lcd/lcd_sejour_screens.dart';
import '../../features/litiges/litiges_screen.dart';
import '../../features/lots/lots_screens.dart';
import '../../features/membres/membres_screens.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/parametres/parametres_screen.dart';
import '../../features/personnel/personnel_screen.dart';
import '../../features/personnel/personnel_rh_screens.dart';
import '../../features/communication/communication_screens.dart';
import '../../features/taches/taches_screens.dart';
import '../../features/parkings/parkings_screens.dart';
import '../../features/cabinet/cabinet_screens.dart';
import '../../features/profil/profil_screens.dart';
import '../../features/shell/app_shell.dart';
import '../../features/visites/visites_screens.dart';
import '../auth/app_state.dart';
import '../i18n/i18n.dart';
import '../theme/motion.dart';

/// Écrans racines d'onglet : fondu enchaîné avec léger zoom (« fade through ») à l'arrivée —
/// changer d'onglet n'est pas avancer dans une pile. Route Material à part entière : quand un
/// écran est poussé PAR-DESSUS, c'est la transition du thème qui s'applique (même délégation
/// que les autres pages, aucune combinaison de transitions hétérogènes).
Page<void> tabPage(GoRouterState state, Widget child) => _TabPage(key: state.pageKey, name: state.name, child: child);

class _TabPage extends Page<void> {
  const _TabPage({super.key, super.name, required this.child});
  final Widget child;
  @override
  Route<void> createRoute(BuildContext context) => _TabRoute(this);
}

class _TabRoute extends PageRoute<void> with MaterialRouteTransitionMixin<void> {
  _TabRoute(_TabPage page) : super(settings: page);

  _TabPage get _page => settings as _TabPage;

  @override
  Widget buildContent(BuildContext context) => _page.child;

  @override
  bool get maintainState => true;

  @override
  bool get fullscreenDialog => false;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 360);

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 220);

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    // Sortie quand un écran est poussé au-dessus : comportement du thème.
    final themed = super.buildTransitions(context, kAlwaysCompleteAnimation, secondaryAnimation, child);
    if (SuMotion.reduced(context)) return themed;
    final inCurve = CurvedAnimation(parent: animation, curve: const Interval(0.25, 1, curve: SuMotion.easeOut));
    return FadeTransition(
      opacity: inCurve,
      child: ScaleTransition(scale: Tween(begin: 0.985, end: 1.0).animate(inCurve), child: themed),
    );
  }
}

const _publicPrefixes = ['/connexion', '/invitation', '/compte'];

bool _isPublic(String path) => path == '/' || _publicPrefixes.any((p) => path == p || path.startsWith('$p/'));

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(Ref ref) {
    ref.listen<AsyncValue<AppState>>(appStateProvider, (_, __) => notifyListeners());
  }
}

/// Routes sans préfixe de locale (la langue est un état de l'app, pas de l'URL). Le `redirect`
/// applique l'aiguillage de session résolu côté serveur (profil réel) — le routeur ne masque
/// rien : l'API refuse ce que le rôle n'autorise pas.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final st = ref.read(appStateProvider);
      final path = state.uri.path;
      if (st.isLoading || (st.hasError && !st.hasValue)) return path == '/splash' ? null : '/splash';
      final s = st.valueOrNull;
      switch (s) {
        case AppSignedOut():
          return _isPublic(path) ? null : '/';
        case AppNeedsInvitation():
          return path.startsWith('/invitation') || path.startsWith('/connexion') ? null : '/invitation';
        case AppSuspended():
          return path == '/compte/suspendu' ? null : '/compte/suspendu';
        case AppEnValidation():
          return path == '/compte/validation' ? null : '/compte/validation';
        case AppSansAcces():
          return path == '/compte/sans-acces' || path.startsWith('/invitation') ? null : '/compte/sans-acces';
        case AppChooseCopro():
          return path == '/choisir-copropriete' ? null : '/choisir-copropriete';
        case AppReady(:final ctx):
          if (ctx.isMembreCabinetSeul) {
            // M25 — sans rôle de copropriété : cabinet et profil seulement.
            const ok = ['/cabinet', '/profil'];
            return ok.any((p) => path == p || path.startsWith('$p/')) ? null : '/cabinet';
          }
          if (_isPublic(path) || path == '/splash') return ctx.isSuperAdmin ? '/admin' : '/tableau-de-bord';
          if (path == '/choisir-copropriete' && !ctx.multiCopro) return '/tableau-de-bord';
          return null;
        case null:
          return '/splash';
      }
    },
    routes: [
      // Démarrage et coque : bascules INSTANTANÉES au niveau racine. Une transition animée ferait
      // coexister deux coques pendant un rechargement de session (ex. changement de langue) : le
      // navigateur imbriqué (GlobalKey) peut alors rester chez l'ancienne et la nouvelle s'affiche
      // vide. Les écrans gardent leurs propres animations d'entrée.
      GoRoute(path: '/splash', pageBuilder: (_, s) => NoTransitionPage<void>(key: s.pageKey, child: const SplashScreen())),
      GoRoute(path: '/', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/connexion', builder: (_, s) => LoginScreen(next: s.uri.queryParameters['next'])),
      GoRoute(path: '/connexion/code', builder: (_, s) => OtpScreen(telephone: s.uri.queryParameters['tel'] ?? '', next: s.uri.queryParameters['next'])),
      GoRoute(path: '/invitation', builder: (_, __) => const InvitationEntryScreen()),
      GoRoute(path: '/invitation/scan', builder: (_, __) => const InvitationScanScreen()),
      GoRoute(path: '/invitation/:code', builder: (_, s) => InvitationCodeScreen(code: s.pathParameters['code']!.toUpperCase())),
      GoRoute(path: '/choisir-copropriete', builder: (_, __) => const ChooseCoproScreen()),
      GoRoute(path: '/compte/:kind', builder: (_, s) => CompteEtatScreen(kind: s.pathParameters['kind']!)),
      ShellRoute(
        pageBuilder: (context, state, child) => NoTransitionPage<void>(key: state.pageKey, child: AppShell(child: child)),
        routes: [
          GoRoute(path: '/tableau-de-bord', pageBuilder: (_, s) => tabPage(s, const DashboardScreen())),
          GoRoute(path: '/lots', pageBuilder: (_, s) => tabPage(s, const LotsScreen())),
          GoRoute(path: '/lots/nouveau', builder: (_, __) => const LotFormScreen()),
          GoRoute(path: '/lots/:id', builder: (_, s) => LotDetailScreen(id: s.pathParameters['id']!, onglet: s.uri.queryParameters['onglet'])),
          GoRoute(path: '/lots/:id/modifier', builder: (_, s) => LotFormScreen(id: s.pathParameters['id'])),
          GoRoute(path: '/finances/budgets', builder: (_, __) => const BudgetsScreen()),
          GoRoute(path: '/finances/appels-de-fonds', pageBuilder: (_, s) => tabPage(s, AppelsScreen(generer: s.uri.queryParameters['generer'] == '1'))),
          GoRoute(path: '/finances/appels-de-fonds/:id', builder: (_, s) => AppelDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/finances/comptabilite', pageBuilder: (_, s) => tabPage(s, const ComptabiliteScreen())),
          GoRoute(path: '/finances/contestations', builder: (_, __) => const ContestationsScreen()),
          GoRoute(path: '/finances/quittances/:id', builder: (_, s) => QuittanceScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag', builder: (_, __) => const AgListScreen()),
          GoRoute(path: '/ag/nouvelle', builder: (_, __) => const AgFormScreen()),
          GoRoute(path: '/ag/:id', builder: (_, s) => AgDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag/:id/seance', builder: (_, s) => AgSeanceScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag/:id/pv', builder: (_, s) => AgPvScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag/:id/resolutions/:rid/votes', builder: (_, s) => AgVotesScreen(agId: s.pathParameters['id']!, resolutionId: s.pathParameters['rid']!)),
          GoRoute(path: '/incidents', pageBuilder: (_, s) => tabPage(s, const IncidentsScreen())),
          GoRoute(path: '/incidents/nouveau', builder: (_, s) => IncidentFormScreen(sejourId: s.uri.queryParameters['sejour'])),
          GoRoute(path: '/incidents/:id', builder: (_, s) => IncidentDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/prestataires', builder: (_, __) => const PrestatairesScreen()),
          GoRoute(path: '/payer', builder: (_, __) => const PayerScreen()),
          GoRoute(path: '/justificatifs', builder: (_, __) => const JustificatifsScreen()),
          GoRoute(path: '/justificatifs/:id', builder: (_, s) => JustificatifDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/especes', builder: (_, __) => const EspecesScreen()),
          GoRoute(path: '/depenses', builder: (_, __) => const DepensesScreen()),
          // M18 — rapports (syndic / conseil, lecture) et transparence « où va mon argent » (tout membre).
          GoRoute(path: '/rapports', pageBuilder: (_, s) => tabPage(s, const RapportsScreen())),
          // M19 — contrats (syndic / conseil, lecture).
          GoRoute(path: '/contrats', builder: (_, __) => const ContratsScreen()),
          GoRoute(path: '/contrats/:id', builder: (_, s) => ContratDetailScreen(id: s.pathParameters['id']!)),
          // M22 — tâches : registre / mes tâches, fiche.
          GoRoute(path: '/taches', pageBuilder: (_, s) => tabPage(s, const TachesScreen())),
          GoRoute(path: '/taches/:id', builder: (_, s) => TacheDetailScreen(id: s.pathParameters['id']!)),
          // M23 — parkings & badges : plan / véhicules / badges / visiteurs, fiche emplacement.
          GoRoute(path: '/parkings', builder: (_, s) => ParkingsScreen(onglet: s.uri.queryParameters['onglet'])),
          // M25 — espace cabinet (lecture : portefeuille, alertes, agenda).
          GoRoute(path: '/cabinet', pageBuilder: (_, s) => tabPage(s, CabinetScreen(cabinetId: s.uri.queryParameters['cabinet']))),
          GoRoute(path: '/parkings/:id', builder: (_, s) => EmplacementDetailScreen(id: s.pathParameters['id']!)),
          // M21 — tableau d'affichage : fil, annonce, sondage.
          GoRoute(path: '/affichage', pageBuilder: (_, s) => tabPage(s, const AffichageScreen())),
          GoRoute(path: '/affichage/sondages/:id', builder: (_, s) => SondageScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/affichage/:id', builder: (_, s) => AnnonceDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/rapports/transparence', builder: (_, __) => const TransparenceScreen()),
          GoRoute(path: '/depenses/:id', builder: (_, s) => DepenseDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/espaces-communs', builder: (_, __) => const EspacesScreen()),
          GoRoute(path: '/reservations', pageBuilder: (_, s) => tabPage(s, const ReservationsScreen())),
          GoRoute(path: '/visites', pageBuilder: (_, s) => tabPage(s, VisitesScreen(enregistrer: s.uri.queryParameters['enregistrer'] == '1'))),
          GoRoute(path: '/visites/:id', builder: (_, s) => VisiteRepondreScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/personnel', builder: (_, __) => const PersonnelScreen()),
          // M20 — dossier RH : « Mon dossier » (employé), planning (syndic / conseil), détail (syndic / soi).
          GoRoute(path: '/personnel/me', builder: (_, s) => MonDossierScreen(onglet: s.uri.queryParameters['onglet'])),
          GoRoute(path: '/personnel/planning', builder: (_, s) => PlanningScreen(semaine: s.uri.queryParameters['semaine'])),
          GoRoute(path: '/personnel/:id', builder: (_, s) => PersonnelDetailScreen(id: s.pathParameters['id']!, onglet: s.uri.queryParameters['onglet'])),
          GoRoute(path: '/location-courte-duree', pageBuilder: (_, s) => tabPage(s, const LcdScreen())),
          GoRoute(path: '/location-courte-duree/reglement', builder: (_, __) => const LcdReglementScreen()),
          GoRoute(path: '/location-courte-duree/declarations/:id', builder: (_, s) => LcdDeclarationScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/location-courte-duree/sejours/nouveau', builder: (_, s) => LcdSejourFormScreen(sejourId: s.uri.queryParameters['sejour'], lotId: s.uri.queryParameters['lot'])),
          GoRoute(path: '/location-courte-duree/sejours/:id', builder: (_, s) => LcdSejourScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/documents', pageBuilder: (_, s) => tabPage(s, const DocumentsScreen())),
          GoRoute(
            path: '/visionneuse',
            builder: (_, s) {
              final e = (s.extra as Map?)?.cast<String, dynamic>() ?? const {};
              final bytes = e['bytes'] as Uint8List?;
              return DocumentViewerScreen(titre: (e['titre'] as String?) ?? '', url: bytes == null ? ((e['url'] as String?) ?? '') : null, bytes: bytes);
            },
          ),
          GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
          GoRoute(path: '/litiges', builder: (_, __) => const LitigesScreen()),
          GoRoute(path: '/profil', builder: (_, __) => const ProfilScreen()),
          GoRoute(path: '/profil/donnees', builder: (_, __) => const DonneesScreen()),
          GoRoute(path: '/membres', builder: (_, __) => const MembresScreen()),
          GoRoute(path: '/membres/:id', builder: (_, s) => MembreDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/invitations', builder: (_, s) => InvitationsScreen(nouvelle: s.uri.queryParameters['nouvelle'] == '1')),
          GoRoute(path: '/parametres', builder: (_, __) => const ParametresScreen()),
          GoRoute(path: '/admin', pageBuilder: (_, s) => tabPage(s, const AdminScreen())),
          GoRoute(path: '/admin/coproprietes/nouvelle', builder: (_, __) => const AdminCoproFormScreen()),
          GoRoute(path: '/admin/coproprietes/:id', builder: (_, s) => AdminCoproDetailScreen(id: s.pathParameters['id']!)),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(context.dict.common.notFoundTitle, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(context.dict.common.notFoundBody, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: () => context.go('/'), child: Text(context.dict.common.backHome)),
            ],
          ),
        ),
      ),
    ),
  );
});

/// Rafraîchit une lecture après une mutation et attend la nouvelle valeur.
Future<void> refreshAll(WidgetRef ref, List<ProviderOrFamily> providers) async {
  for (final p in providers) {
    ref.invalidate(p);
  }
}
