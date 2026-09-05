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
import '../../features/profil/profil_screens.dart';
import '../../features/shell/app_shell.dart';
import '../../features/visites/visites_screens.dart';
import '../auth/app_state.dart';
import '../i18n/i18n.dart';

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
          if (_isPublic(path) || path == '/splash') return ctx.isSuperAdmin ? '/admin' : '/tableau-de-bord';
          if (path == '/choisir-copropriete' && !ctx.multiCopro) return '/tableau-de-bord';
          return null;
        case null:
          return '/splash';
      }
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/connexion', builder: (_, s) => LoginScreen(next: s.uri.queryParameters['next'])),
      GoRoute(path: '/connexion/code', builder: (_, s) => OtpScreen(telephone: s.uri.queryParameters['tel'] ?? '', next: s.uri.queryParameters['next'])),
      GoRoute(path: '/invitation', builder: (_, __) => const InvitationEntryScreen()),
      GoRoute(path: '/invitation/scan', builder: (_, __) => const InvitationScanScreen()),
      GoRoute(path: '/invitation/:code', builder: (_, s) => InvitationCodeScreen(code: s.pathParameters['code']!.toUpperCase())),
      GoRoute(path: '/choisir-copropriete', builder: (_, __) => const ChooseCoproScreen()),
      GoRoute(path: '/compte/:kind', builder: (_, s) => CompteEtatScreen(kind: s.pathParameters['kind']!)),
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/tableau-de-bord', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/lots', builder: (_, __) => const LotsScreen()),
          GoRoute(path: '/lots/nouveau', builder: (_, __) => const LotFormScreen()),
          GoRoute(path: '/lots/:id', builder: (_, s) => LotDetailScreen(id: s.pathParameters['id']!, onglet: s.uri.queryParameters['onglet'])),
          GoRoute(path: '/lots/:id/modifier', builder: (_, s) => LotFormScreen(id: s.pathParameters['id'])),
          GoRoute(path: '/finances/budgets', builder: (_, __) => const BudgetsScreen()),
          GoRoute(path: '/finances/appels-de-fonds', builder: (_, s) => AppelsScreen(generer: s.uri.queryParameters['generer'] == '1')),
          GoRoute(path: '/finances/appels-de-fonds/:id', builder: (_, s) => AppelDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/finances/comptabilite', builder: (_, __) => const ComptabiliteScreen()),
          GoRoute(path: '/finances/contestations', builder: (_, __) => const ContestationsScreen()),
          GoRoute(path: '/finances/quittances/:id', builder: (_, s) => QuittanceScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag', builder: (_, __) => const AgListScreen()),
          GoRoute(path: '/ag/nouvelle', builder: (_, __) => const AgFormScreen()),
          GoRoute(path: '/ag/:id', builder: (_, s) => AgDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag/:id/seance', builder: (_, s) => AgSeanceScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag/:id/pv', builder: (_, s) => AgPvScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/ag/:id/resolutions/:rid/votes', builder: (_, s) => AgVotesScreen(agId: s.pathParameters['id']!, resolutionId: s.pathParameters['rid']!)),
          GoRoute(path: '/incidents', builder: (_, __) => const IncidentsScreen()),
          GoRoute(path: '/incidents/nouveau', builder: (_, s) => IncidentFormScreen(sejourId: s.uri.queryParameters['sejour'])),
          GoRoute(path: '/incidents/:id', builder: (_, s) => IncidentDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/prestataires', builder: (_, __) => const PrestatairesScreen()),
          GoRoute(path: '/payer', builder: (_, __) => const PayerScreen()),
          GoRoute(path: '/justificatifs', builder: (_, __) => const JustificatifsScreen()),
          GoRoute(path: '/justificatifs/:id', builder: (_, s) => JustificatifDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/especes', builder: (_, __) => const EspecesScreen()),
          GoRoute(path: '/depenses', builder: (_, __) => const DepensesScreen()),
          GoRoute(path: '/depenses/:id', builder: (_, s) => DepenseDetailScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/espaces-communs', builder: (_, __) => const EspacesScreen()),
          GoRoute(path: '/reservations', builder: (_, __) => const ReservationsScreen()),
          GoRoute(path: '/visites', builder: (_, s) => VisitesScreen(enregistrer: s.uri.queryParameters['enregistrer'] == '1')),
          GoRoute(path: '/visites/:id', builder: (_, s) => VisiteRepondreScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/personnel', builder: (_, __) => const PersonnelScreen()),
          GoRoute(path: '/location-courte-duree', builder: (_, __) => const LcdScreen()),
          GoRoute(path: '/location-courte-duree/reglement', builder: (_, __) => const LcdReglementScreen()),
          GoRoute(path: '/location-courte-duree/declarations/:id', builder: (_, s) => LcdDeclarationScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/location-courte-duree/sejours/nouveau', builder: (_, s) => LcdSejourFormScreen(sejourId: s.uri.queryParameters['sejour'], lotId: s.uri.queryParameters['lot'])),
          GoRoute(path: '/location-courte-duree/sejours/:id', builder: (_, s) => LcdSejourScreen(id: s.pathParameters['id']!)),
          GoRoute(path: '/documents', builder: (_, __) => const DocumentsScreen()),
          GoRoute(
            path: '/visionneuse',
            builder: (_, s) {
              final e = (s.extra as Map?)?.cast<String, dynamic>() ?? const {};
              return DocumentViewerScreen(titre: (e['titre'] as String?) ?? '', url: (e['url'] as String?) ?? '');
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
          GoRoute(path: '/admin', builder: (_, __) => const AdminScreen()),
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
