import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session.dart';
import '../format/centimes.dart';
import 'api_client.dart';
import 'api_result.dart';
import 'models.dart';

/// Lectures (server state) — un provider par ressource, invalidé de façon ciblée après chaque
/// mutation (`ref.invalidate(...)`), jamais de refetch global (Master Spec 11.5). Aucune
/// donnée financière n'est mise en cache au-delà de l'écran (autoDispose).

final profilProvider = FutureProvider.autoDispose<Profil>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/users/me', parse: (j) => Profil.fromJson(asMap(j))));
});

final coproprietesProvider = FutureProvider.autoDispose<List<Copropriete>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/coproprietes', parse: (j) => parseList(j, Copropriete.fromJson)));
});

final coproprieteProvider = FutureProvider.autoDispose.family<Copropriete, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/coproprietes/$id', parse: (j) => Copropriete.fromJson(asMap(j))));
});

/// Photos personnalisées de la résidence (M20) : `{ cle: url signée 15 min }` — carte vide sans
/// personnalisation ; les widgets retombent alors sur l'image par défaut de l'application.
final coproPhotosProvider = FutureProvider.family<Map<String, String>, String>((ref, id) async {
  final r = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/coproprietes/$id/photos', coproprieteId: id, parse: asMap);
  final photos = r.dataOrNull?['photos'];
  if (photos is! Map) return const {};
  return {for (final e in photos.entries) if (e.value is String) e.key.toString(): e.value as String};
});

final adminSyntheseProvider = FutureProvider.autoDispose.family<AdminSynthese, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/coproprietes/$id/synthese-admin', coproprieteId: id, parse: (j) => AdminSynthese.fromJson(asMap(j))));
});

final logoUrlProvider = FutureProvider.autoDispose.family<String?, String>((ref, coproId) async {
  final r = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/coproprietes/$coproId/logo', parse: asMap);
  return r.dataOrNull?['url'] as String?;
});

final lotsProvider = FutureProvider.autoDispose<List<Lot>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lots', query: {'limit': 100}, parse: (j) => parseList(j, Lot.fromJson)));
});

final lotProvider = FutureProvider.autoDispose.family<Lot, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lots/$id', parse: (j) => Lot.fromJson(asMap(j))));
});

final soldeLotProvider = FutureProvider.autoDispose.family<SoldeLot, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/finances/lots/$id/solde', parse: (j) => SoldeLot.fromJson(asMap(j))));
});

final syntheseProvider = FutureProvider.autoDispose<SyntheseFinanciere>((ref) async {
  final r = await ref.watch(apiClientProvider).get<SyntheseFinanciere>('/finances/synthese', parse: (j) => SyntheseFinanciere.fromJson(asMap(j)));
  // Rôles sans lecture financière (gardien, prestataire) : synthèse vide plutôt qu'une erreur.
  return r.dataOrNull ?? const SyntheseFinanciere();
});

final budgetsProvider = FutureProvider.autoDispose<List<BudgetAg>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/finances/budgets', parse: (j) => parseList(j, BudgetAg.fromJson)));
});

final appelsProvider = FutureProvider.autoDispose<List<AppelDeFonds>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/finances/appels-de-fonds', query: {'limit': 100}, parse: (j) => parseList(j, AppelDeFonds.fromJson)));
});

final appelProvider = FutureProvider.autoDispose.family<AppelDeFonds, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/finances/appels-de-fonds/$id', parse: (j) => AppelDeFonds.fromJson(asMap(j))));
});

final paiementsProvider = FutureProvider.autoDispose<List<Paiement>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<Paiement>>('/finances/paiements', parse: (j) => parseList(j, Paiement.fromJson));
  return r.dataOrNull ?? const [];
});

final quittanceProvider = FutureProvider.autoDispose.family<Quittance, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/finances/quittances/$id', parse: (j) => Quittance.fromJson(asMap(j))));
});

final contestationsProvider = FutureProvider.autoDispose<List<Contestation>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<Contestation>>('/finances/contestations', parse: (j) => parseList(j, Contestation.fromJson));
  return r.dataOrNull ?? const [];
});

final agListProvider = FutureProvider.autoDispose<List<AssembleeGenerale>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/ag', query: {'limit': 50}, parse: (j) => parseList(j, AssembleeGenerale.fromJson)));
});

final agProvider = FutureProvider.autoDispose.family<AssembleeGenerale, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/ag/$id', parse: (j) => AssembleeGenerale.fromJson(asMap(j))));
});

final agProcurationsProvider = FutureProvider.autoDispose.family<List<AgProcuration>, String>((ref, id) async {
  final r = await ref.watch(apiClientProvider).get<List<AgProcuration>>('/ag/$id/procurations', parse: (j) => parseList(j, AgProcuration.fromJson));
  return r.dataOrNull ?? const [];
});

final agResultatsProvider = FutureProvider.autoDispose.family<List<AgResultatLigne>, ({String agId, String resolutionId})>((ref, k) async {
  final r = await ref.watch(apiClientProvider).get<List<AgResultatLigne>>('/ag/${k.agId}/resolutions/${k.resolutionId}/resultats', parse: (j) => parseList(j, AgResultatLigne.fromJson));
  return r.dataOrNull ?? const [];
});

final agVotesProvider = FutureProvider.autoDispose.family<List<AgVote>, ({String agId, String resolutionId})>((ref, k) async {
  return unwrap(await ref.watch(apiClientProvider).get('/ag/${k.agId}/resolutions/${k.resolutionId}/votes', parse: (j) => parseList(j, AgVote.fromJson)));
});

final agPvProvider = FutureProvider.autoDispose.family<AgPv, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/ag/$id/pv', parse: (j) => AgPv.fromJson(asMap(j))));
});

final incidentsProvider = FutureProvider.autoDispose<List<Incident>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/incidents', query: {'limit': 100}, parse: (j) => parseList(j, Incident.fromJson)));
});

final incidentProvider = FutureProvider.autoDispose.family<Incident, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/incidents/$id', parse: (j) => Incident.fromJson(asMap(j))));
});

final incidentPhotosProvider = FutureProvider.autoDispose.family<List<IncidentPhoto>, String>((ref, id) async {
  final r = await ref.watch(apiClientProvider).get<List<IncidentPhoto>>('/incidents/$id/photos', parse: (j) => parseList(j, IncidentPhoto.fromJson));
  return r.dataOrNull ?? const [];
});

final prestatairesProvider = FutureProvider.autoDispose<List<Prestataire>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<Prestataire>>('/prestataires', parse: (j) => parseList(j, Prestataire.fromJson));
  return r.dataOrNull ?? const [];
});

final personnelProvider = FutureProvider.autoDispose<List<Personnel>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<Personnel>>('/personnel', parse: (j) => parseList(j, Personnel.fromJson));
  return r.dataOrNull ?? const [];
});

final visitesProvider = FutureProvider.autoDispose<List<Visite>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/visites', parse: (j) => parseList(j, Visite.fromJson)));
});

final espacesProvider = FutureProvider.autoDispose<List<EspaceCommun>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/espaces-communs', parse: (j) => parseList(j, EspaceCommun.fromJson)));
});

final reservationsProvider = FutureProvider.autoDispose<List<Reservation>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/reservations', parse: (j) => parseList(j, Reservation.fromJson)));
});

final documentsProvider = FutureProvider.autoDispose<List<DocumentCopro>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<DocumentCopro>>('/documents', parse: (j) => parseList(j, DocumentCopro.fromJson));
  return r.dataOrNull ?? const [];
});

final litigesProvider = FutureProvider.autoDispose<List<Litige>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<Litige>>('/litiges', parse: (j) => parseList(j, Litige.fromJson));
  return r.dataOrNull ?? const [];
});

final membresProvider = FutureProvider.autoDispose<List<Membre>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/users', parse: (j) => parseList(j, Membre.fromJson)));
});

final membreProvider = FutureProvider.autoDispose.family<Profil, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/users/$id', parse: (j) => Profil.fromJson(asMap(j))));
});

final invitationsProvider = FutureProvider.autoDispose<List<Invitation>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/invitations', parse: (j) => parseList(j, Invitation.fromJson)));
});

// ── Dérivations financières d'affichage (centimes BigInt) ─────────────────────

class TotauxAppel {
  BigInt du = BigInt.zero;
  BigInt paye = BigInt.zero;
  double get taux => ratio(paye, du);
}

Map<String, TotauxAppel> totauxParAppel(SyntheseFinanciere s) {
  final m = <String, TotauxAppel>{for (final a in s.appels) a.id: TotauxAppel()};
  for (final l in s.lignes) {
    final t = m[l.appelDeFondsId];
    if (t == null) continue;
    t.du += versCentimes(l.montantDu);
    t.paye += versCentimes(l.montantPaye);
  }
  return m;
}

Map<String, BigInt> soldeParLot(SyntheseFinanciere s) {
  final m = <String, BigInt>{};
  for (final l in s.lignes) {
    m[l.lotId] = (m[l.lotId] ?? BigInt.zero) + versCentimes(l.montantDu) - versCentimes(l.montantPaye);
  }
  return m;
}

({BigInt du, BigInt paye, BigInt impaye, double taux}) totauxGlobaux(SyntheseFinanciere s) {
  final du = sommeCentimes(s.lignes.map((l) => l.montantDu));
  final paye = sommeCentimes(s.lignes.map((l) => l.montantPaye));
  return (du: du, paye: paye, impaye: du - paye, taux: ratio(paye, du));
}

List<({String niveau, int count, BigInt montant})> impayesParNiveau(SyntheseFinanciere s) {
  const niveaux = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
  return [
    for (final n in niveaux)
      () {
        final c = s.lignes.where((l) => l.niveauEscalade == n && l.statut != 'PAYE').toList();
        return (niveau: n, count: c.length, montant: sommeCentimes(c.map((l) => l.montantDu)) - sommeCentimes(c.map((l) => l.montantPaye)));
      }()
  ].where((x) => x.count > 0).toList();
}

/// Annuaire léger reconstruit depuis les rattachements des lots (sélecteurs : mandataire,
/// payeur…) — même approche que apps/web/lib/membres.ts.
class MembreOption {
  final String id;
  final String nom;
  final List<String> lots;
  const MembreOption({required this.id, required this.nom, required this.lots});
}

List<MembreOption> annuaireDepuisLots(List<Lot> lots) {
  final parId = <String, MembreOption>{};
  for (final lot in lots) {
    for (final r in [...lot.proprietaires.map((p) => (p.utilisateurId, p.utilisateur)), ...lot.occupants.map((o) => (o.utilisateurId, o.utilisateur))]) {
      final nom = [r.$2?.prenom, r.$2?.nom].whereType<String>().where((s) => s.isNotEmpty).join(' ');
      final e = parId[r.$1];
      if (e != null) {
        if (!e.lots.contains(lot.numero)) e.lots.add(lot.numero);
      } else {
        parId[r.$1] = MembreOption(id: r.$1, nom: nom.isEmpty ? r.$1.substring(0, 8) : nom, lots: [lot.numero]);
      }
    }
  }
  final l = parId.values.toList()..sort((a, b) => a.nom.compareTo(b.nom));
  return l;
}

// ── M15 Location courte durée ─────────────────────────────────────────────────

final lcdReglementProvider = FutureProvider.autoDispose<LcdReglement>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lcd/reglement', parse: (j) => LcdReglement.fromJson(asMap(j))));
});

final lcdDeclarationsProvider = FutureProvider.autoDispose<List<LcdDeclaration>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lcd/declarations', parse: (j) => parseList(j, LcdDeclaration.fromJson)));
});

final lcdDeclarationProvider = FutureProvider.autoDispose.family<LcdDeclaration, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lcd/declarations/$id', parse: (j) => LcdDeclaration.fromJson(asMap(j))));
});

final lcdSejoursProvider = FutureProvider.autoDispose<List<LcdSejour>>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lcd/sejours', parse: (j) => parseList(j, LcdSejour.fromJson)));
});

/// Séjours en cours — sélecteur « lier à un séjour » du formulaire d'incident. Rôles sans
/// lecture LCD (locataire, prestataire) : liste vide, jamais une erreur.
final lcdSejoursEnCoursProvider = FutureProvider.autoDispose<List<LcdSejour>>((ref) async {
  final r = await ref.watch(apiClientProvider).get<List<LcdSejour>>('/lcd/sejours', query: {'statut': 'EN_COURS'}, parse: (j) => parseList(j, LcdSejour.fromJson));
  return r.dataOrNull ?? const [];
});

final lcdSejourProvider = FutureProvider.autoDispose.family<LcdSejour, String>((ref, id) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lcd/sejours/$id', parse: (j) => LcdSejour.fromJson(asMap(j))));
});

final lcdDuJourProvider = FutureProvider.autoDispose<LcdDuJour>((ref) async {
  return unwrap(await ref.watch(apiClientProvider).get('/lcd/sejours/du-jour', parse: (j) => LcdDuJour.fromJson(asMap(j))));
});

/// Synthèse LCD d'un lot (fiche lot) — `null` si le rôle n'y a pas accès (403) ou si le lot
/// est inconnu (404) : la section est alors simplement absente.
final lcdSyntheseProvider = FutureProvider.autoDispose.family<LcdSynthese?, String>((ref, lotId) async {
  final r = await ref.watch(apiClientProvider).get<LcdSynthese>('/lcd/lots/$lotId/synthese', parse: (j) => LcdSynthese.fromJson(asMap(j)));
  return switch (r) {
    ApiOk<LcdSynthese>(:final data) => data,
    ApiFail<LcdSynthese>(:final status) when status == 403 || status == 404 => null,
    ApiFail<LcdSynthese>() => unwrap(r),
  };
});
