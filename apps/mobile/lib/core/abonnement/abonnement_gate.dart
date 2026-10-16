import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_result.dart';
import '../auth/app_state.dart';
import '../auth/session.dart';

/// État de l'abonnement SyndicUp de la résidence active (GET /v1/abonnement — M29, oct. 2026).
///   - `BLOQUE` : résidence fermée → écran « accès suspendu » (tout le monde).
///   - `RAPPEL` / `GRACE` : fenêtre de rappel pour le syndic (jamais pour les résidents).
///   - erreur réseau / opérateur / cabinet seul → rien : on ne bloque jamais sur une panne.
/// L'API reste la vraie barrière (402 ABONNEMENT_SUSPENDU) ; un 402 reçu ailleurs relance ce provider.
class AbonnementResidence {
  const AbonnementResidence({
    required this.niveau,
    required this.etat,
    required this.gestionnaire,
    this.echeance,
    this.joursAvantEcheance,
    this.dateBlocage,
    this.joursAvantBlocage,
    this.contactEmail,
    this.contactWhatsapp,
  });

  final String niveau;
  final String etat;
  final bool gestionnaire;
  final String? echeance;
  final int? joursAvantEcheance;
  final String? dateBlocage;
  final int? joursAvantBlocage;
  final String? contactEmail;
  final String? contactWhatsapp;

  bool get bloque => niveau == 'BLOQUE';
  bool get rappelVisible => gestionnaire && (niveau == 'RAPPEL' || niveau == 'GRACE');
  String get cle => '$niveau:${echeance ?? ''}';

  factory AbonnementResidence.fromJson(Map<String, dynamic> j) {
    final contact = (j['contact'] as Map?)?.cast<String, dynamic>() ?? const {};
    return AbonnementResidence(
      niveau: j['niveau'] as String? ?? 'OK',
      etat: j['etat'] as String? ?? 'SANS_ABONNEMENT',
      gestionnaire: j['gestionnaire'] as bool? ?? false,
      echeance: j['echeance'] as String?,
      joursAvantEcheance: (j['jours_avant_echeance'] as num?)?.toInt(),
      dateBlocage: j['date_blocage'] as String?,
      joursAvantBlocage: (j['jours_avant_blocage'] as num?)?.toInt(),
      contactEmail: contact['email'] as String?,
      contactWhatsapp: contact['whatsapp'] as String?,
    );
  }
}

final abonnementProvider = FutureProvider<AbonnementResidence?>((ref) async {
  final app = ref.watch(appStateProvider).valueOrNull;
  if (app is! AppReady) return null;
  if (app.ctx.isSuperAdmin || app.ctx.isMembreCabinetSeul) return null;
  final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/abonnement',
        coproprieteId: app.ctx.coproprieteId,
        parse: (j) => (j as Map).cast<String, dynamic>(),
      );
  if (res is! ApiOk<Map<String, dynamic>>) return null;
  return AbonnementResidence.fromJson(res.data);
});

/// Rappel refermé pour ce lancement (clé niveau + échéance : un nouveau palier se réaffiche).
final abonnementRappelFermeProvider = StateProvider<String?>((_) => null);
