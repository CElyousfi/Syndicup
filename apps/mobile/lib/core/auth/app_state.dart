import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_result.dart';
import '../api/models.dart';
import '../i18n/i18n.dart';
import 'session.dart';

/// Rôles du système (Master Spec 4.1) — priorité descendante pour le rôle principal.
const List<String> rolePriorite = [
  'SUPER_ADMIN', 'SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'INDIVISAIRE',
  'PERSONNE_MORALE_REPRESENTANT', 'GESTIONNAIRE_LCD', 'LOCATAIRE', 'GARDIEN', 'PRESTATAIRE',
];

/// Contexte applicatif d'une session prête — équivalent mobile de apps/web/lib/app-context.ts.
/// La sécurité réelle reste l'API + RLS : ce contexte sert à construire la navigation par rôle,
/// jamais à « autoriser » quoi que ce soit (docs/PARITE_WEB_MOBILE.md M12).
class AppContext {
  final Profil profil;
  final String role;
  final List<String> roles;
  final Copropriete? copropriete;
  final List<Copropriete> coproprietes;
  final String coproprieteId;
  const AppContext({required this.profil, required this.role, required this.roles, required this.copropriete, required this.coproprietes, required this.coproprieteId});

  bool has(String r) => roles.contains(r);
  bool get isSuperAdmin => has('SUPER_ADMIN');
  bool get isSyndic => has('SYNDIC');
  /// Gestion : syndic ou opérateur plateforme.
  bool get isGestion => isSyndic || isSuperAdmin;
  bool get isConseil => has('CONSEIL_SYNDICAL');
  bool get isGardien => has('GARDIEN');
  bool get isPrestataire => role == 'PRESTATAIRE';
  bool get isLocataire => role == 'LOCATAIRE';
  bool get isProprietaire => has('PROPRIETAIRE') || has('INDIVISAIRE') || has('PERSONNE_MORALE_REPRESENTANT');
  /// Gestionnaire de location courte durée désigné par un propriétaire (M15, Doc A §10.2).
  bool get isGestionnaireLcd => has('GESTIONNAIRE_LCD');
  /// Accès au module LCD : syndic, conseil (lecture), propriétaires, gestionnaire, gardien (terrain).
  bool get voitLcd => isGestion || isConseil || isProprietaire || isGestionnaireLcd || isGardien;
  /// Peut déclarer un séjour : propriétaire de son lot, gestionnaire désigné, syndic (au nom de).
  bool get declareSejoursLcd => isGestion || isProprietaire || isGestionnaireLcd;
  /// Résident (propriétaire, indivisaire, personne morale, locataire) sans casquette de gestion.
  bool get isResident => !isGestion && !isConseil && !isGardien && !isPrestataire;
  /// Lecture financière étendue : syndic, conseil, super admin.
  bool get voitFinancesGlobales => isGestion || isConseil;
  bool get voitAg => !isLocataire && !isGardien && !isPrestataire && role != 'GESTIONNAIRE_LCD';
  bool get multiCopro => profil.roles.where((r) => r.actif).map((r) => r.coproprieteId).toSet().length > 1;

  String get prenom => profil.prenom ?? [profil.prenom, profil.nom].whereType<String>().join(' ');
}

sealed class AppState {
  const AppState();
}

class AppSignedOut extends AppState {
  const AppSignedOut();
}

/// Authentifié mais sans profil (404) ou sans rôle (401 « JWT sans rôle ») : invité qui n'a
/// pas encore accepté son invitation.
class AppNeedsInvitation extends AppState {
  const AppNeedsInvitation();
}

class AppSuspended extends AppState {
  const AppSuspended();
}

class AppEnValidation extends AppState {
  const AppEnValidation();
}

class AppSansAcces extends AppState {
  const AppSansAcces();
}

class AppChooseCopro extends AppState {
  final Profil profil;
  final List<Copropriete> coproprietes;
  const AppChooseCopro(this.profil, this.coproprietes);
}

class AppReady extends AppState {
  final AppContext ctx;
  const AppReady(this.ctx);
}

/// Aiguillage post-authentification résolu à partir du profil réel (jamais par masquage
/// client) — port de apps/web/lib/bootstrap.ts + app-context.ts.
class AppStateController extends AsyncNotifier<AppState> {
  @override
  Future<AppState> build() async {
    final session = ref.watch(sessionProvider);
    if (session == null) return const AppSignedOut();
    return _resolve(session);
  }

  ApiClient get _api => ref.read(apiClientProvider);

  Future<AppState> _resolve(Session session) async {
    final me = await _api.get<Profil>('/users/me', parse: (j) => Profil.fromJson(asMap(j)));
    if (me is ApiFail<Profil>) {
      if (me.status == 404 || me.status == 401) return const AppNeedsInvitation();
      if (me.status == 0) throw ApiException(me.error, 0, requestId: me.requestId);
      throw ApiException(me.error, me.status, requestId: me.requestId);
    }
    final profil = (me as ApiOk<Profil>).data;
    if (profil.statutCompte == 'SUSPENDU') return const AppSuspended();

    final rolesActifs = profil.roles.where((r) => r.actif).toList();
    final coproIds = rolesActifs.map((r) => r.coproprieteId).toSet().toList();
    final estSuperAdmin = rolesActifs.any((r) => r.role == 'SUPER_ADMIN');

    if (rolesActifs.isEmpty) {
      return profil.statutCompte == 'EN_VALIDATION' ? const AppEnValidation() : const AppSansAcces();
    }

    // Langue de l'interface alignée sur le profil (J1) — une seule fois par chargement.
    await ref.read(localeProvider.notifier).syncFromProfile(profil.languePreferee);

    final coprosRes = await _api.get<List<Copropriete>>('/coproprietes', parse: (j) => parseList(j, Copropriete.fromJson));
    final coproprietes = coprosRes.dataOrNull ?? const <Copropriete>[];

    String? coproId = session.coproprieteId;
    if (estSuperAdmin && (coproId == null || coproId.isEmpty)) {
      coproId = rolesActifs.firstWhere((r) => r.role == 'SUPER_ADMIN').coproprieteId;
    }
    if (coproId == null || (!estSuperAdmin && !coproIds.contains(coproId))) {
      if (coproIds.length == 1) {
        coproId = coproIds.first;
        await ref.read(sessionProvider.notifier).chooseCopropriete(coproId);
      } else {
        return AppChooseCopro(profil, coproprietes.where((c) => coproIds.contains(c.id)).toList());
      }
    }

    final rolesIci = rolesActifs.where((r) => r.coproprieteId == coproId).map((r) => r.role).toList();
    if (estSuperAdmin && !rolesIci.contains('SUPER_ADMIN')) rolesIci.add('SUPER_ADMIN');
    final role = rolePriorite.firstWhere(rolesIci.contains, orElse: () => rolesIci.isEmpty ? 'LOCATAIRE' : rolesIci.first);

    return AppReady(AppContext(
      profil: profil,
      role: role,
      roles: rolesIci,
      copropriete: coproprietes.where((c) => c.id == coproId).firstOrNull,
      coproprietes: coproprietes,
      coproprieteId: coproId,
    ));
  }

  /// Rejoue la résolution (après acceptation d'invitation, changement de profil…).
  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final s = ref.read(sessionProvider);
      if (s == null) return const AppSignedOut();
      return _resolve(s);
    });
  }
}

final appStateProvider = AsyncNotifierProvider<AppStateController, AppState>(AppStateController.new);

/// Contexte prêt — à n'utiliser que sous la coque (le routeur garantit AppReady).
final appContextProvider = Provider<AppContext>((ref) {
  final s = ref.watch(appStateProvider).valueOrNull;
  if (s is AppReady) return s.ctx;
  throw StateError('appContextProvider lu hors d\'une session prête');
});
