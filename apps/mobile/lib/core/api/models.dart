// Types des réponses RÉELLES de l'API — alignés sur apps/web/lib/api/types.ts (source : le
// code des routes/services). Règles : Decimal → chaîne décimale (jamais un double), DateTime →
// ISO 8601, enums → SCREAMING_SNAKE_CASE (conservés en String : les libellés viennent du
// dictionnaire `dict.enums.*`).

String _s(Map<String, dynamic> j, String k) => (j[k] ?? '').toString();
String? _sn(Map<String, dynamic> j, String k) => j[k] == null ? null : j[k].toString();
int? _in(Map<String, dynamic> j, String k) => (j[k] as num?)?.toInt();
bool _b(Map<String, dynamic> j, String k, [bool d = false]) => (j[k] as bool?) ?? d;
List<T> _list<T>(dynamic v, T Function(Map<String, dynamic>) f) =>
    v is List ? v.whereType<Map>().map((e) => f(e.cast<String, dynamic>())).toList() : const [];
Map<String, dynamic>? _map(dynamic v) => v is Map ? v.cast<String, dynamic>() : null;

// ── Auth ────────────────────────────────────────────────────────────────────
class SessionTokens {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final String? utilisateurId;
  const SessionTokens({required this.accessToken, required this.refreshToken, required this.expiresIn, this.utilisateurId});
  factory SessionTokens.fromJson(Map<String, dynamic> j) => SessionTokens(
        accessToken: _s(j, 'access_token'),
        refreshToken: _s(j, 'refresh_token'),
        expiresIn: _in(j, 'expires_in') ?? 3600,
        utilisateurId: _sn(j, 'utilisateur_id'),
      );
}

class InviteApercu {
  final String coproprieteNom;
  final String ville;
  final String roleCible;
  final String expireLe;
  final String statut; // EN_ATTENTE | ACCEPTEE | EXPIREE | REGENEREE | INVALIDE | OUVERTE
  final bool ouverte;
  const InviteApercu({required this.coproprieteNom, required this.ville, required this.roleCible, required this.expireLe, required this.statut, this.ouverte = false});
  factory InviteApercu.fromJson(Map<String, dynamic> j) => InviteApercu(
        coproprieteNom: _s(j, 'copropriete_nom'),
        ville: _s(j, 'ville'),
        roleCible: _s(j, 'role_cible'),
        expireLe: _s(j, 'expire_le'),
        statut: _s(j, 'statut'),
        ouverte: _b(j, 'ouverte'),
      );
}

class InviteInscriptionResult {
  final SessionTokens tokens;
  final String coproprieteId;
  final String role;
  final String statutCompte;
  const InviteInscriptionResult({required this.tokens, required this.coproprieteId, required this.role, required this.statutCompte});
  factory InviteInscriptionResult.fromJson(Map<String, dynamic> j) => InviteInscriptionResult(
        tokens: SessionTokens.fromJson(j),
        coproprieteId: _s(j, 'copropriete_id'),
        role: _s(j, 'role'),
        statutCompte: _s(j, 'statut_compte'),
      );
}

class InviteAcceptResult {
  final String coproprieteId;
  final String? lotId;
  final String role;
  final String statutCompte;
  const InviteAcceptResult({required this.coproprieteId, this.lotId, required this.role, required this.statutCompte});
  factory InviteAcceptResult.fromJson(Map<String, dynamic> j) => InviteAcceptResult(
        coproprieteId: _s(j, 'copropriete_id'),
        lotId: _sn(j, 'lot_id'),
        role: _s(j, 'role'),
        statutCompte: _s(j, 'statut_compte'),
      );
}

// ── Utilisateurs ────────────────────────────────────────────────────────────
class ProfilRole {
  final String coproprieteId;
  final String role;
  final bool actif;
  const ProfilRole({required this.coproprieteId, required this.role, required this.actif});
  factory ProfilRole.fromJson(Map<String, dynamic> j) =>
      ProfilRole(coproprieteId: _s(j, 'copropriete_id'), role: _s(j, 'role'), actif: _b(j, 'actif', true));
}

class Profil {
  final String id;
  final String? email;
  final String? telephone;
  final String? nom;
  final String? prenom;
  final String languePreferee;
  final String statutCompte;
  final String? raisonSociale;
  final List<ProfilRole> roles;
  const Profil({required this.id, this.email, this.telephone, this.nom, this.prenom, required this.languePreferee, required this.statutCompte, this.raisonSociale, this.roles = const []});
  factory Profil.fromJson(Map<String, dynamic> j) => Profil(
        id: _s(j, 'id'),
        email: _sn(j, 'email'),
        telephone: _sn(j, 'telephone'),
        nom: _sn(j, 'nom'),
        prenom: _sn(j, 'prenom'),
        languePreferee: _s(j, 'langue_preferee'),
        statutCompte: _s(j, 'statut_compte'),
        raisonSociale: _sn(j, 'raison_sociale'),
        roles: _list(j['roles'], ProfilRole.fromJson),
      );
}

class MembreRole {
  final String role;
  final bool actif;
  final String depuis;
  const MembreRole({required this.role, required this.actif, required this.depuis});
}

class MembreLot {
  final String id;
  final String numero;
  final String lien; // PROPRIETAIRE | OCCUPANT
  const MembreLot({required this.id, required this.numero, required this.lien});
}

/// GET /users — annuaire syndic.
class Membre {
  final String id;
  final String? email;
  final String? telephone;
  final String? nom;
  final String? prenom;
  final String languePreferee;
  final String statutCompte;
  final List<MembreRole> roles;
  final List<MembreLot> lots;
  final String membreDepuis;
  const Membre({required this.id, this.email, this.telephone, this.nom, this.prenom, required this.languePreferee, required this.statutCompte, required this.roles, required this.lots, required this.membreDepuis});
  factory Membre.fromJson(Map<String, dynamic> j) => Membre(
        id: _s(j, 'id'),
        email: _sn(j, 'email'),
        telephone: _sn(j, 'telephone'),
        nom: _sn(j, 'nom'),
        prenom: _sn(j, 'prenom'),
        languePreferee: _s(j, 'langue_preferee'),
        statutCompte: _s(j, 'statut_compte'),
        roles: _list(j['roles'], (r) => MembreRole(role: _s(r, 'role'), actif: _b(r, 'actif', true), depuis: _s(r, 'depuis'))),
        lots: _list(j['lots'], (l) => MembreLot(id: _s(l, 'id'), numero: _s(l, 'numero'), lien: _s(l, 'lien'))),
        membreDepuis: _s(j, 'membre_depuis'),
      );
}

// ── Copropriétés ────────────────────────────────────────────────────────────
class Copropriete {
  final String id;
  final String nom;
  final String adresse;
  final String ville;
  final String typeResidence;
  final int nbLots;
  final String statut;
  final Map<String, dynamic>? configJson;
  final String? logoStoragePath;
  /// Photos personnalisées de la résidence (M20) : `{ cle: chemin storage }`.
  final Map<String, dynamic>? photosJson;
  final int? delaiConvocationJours;
  final String? totalTantiemes;
  final Map<String, dynamic>? politiqueRecouvrementJson;
  final String? quorumPremiereConvocation;
  final int? limiteProcurationsMandataire;
  final int? retentionDesactivationMois;
  final String creeLe;
  const Copropriete({required this.id, required this.nom, required this.adresse, required this.ville, required this.typeResidence, required this.nbLots, required this.statut, this.configJson, this.logoStoragePath, this.photosJson, this.delaiConvocationJours, this.totalTantiemes, this.politiqueRecouvrementJson, this.quorumPremiereConvocation, this.limiteProcurationsMandataire, this.retentionDesactivationMois, required this.creeLe});
  factory Copropriete.fromJson(Map<String, dynamic> j) => Copropriete(
        id: _s(j, 'id'),
        nom: _s(j, 'nom'),
        adresse: _s(j, 'adresse'),
        ville: _s(j, 'ville'),
        typeResidence: _s(j, 'typeResidence'),
        nbLots: _in(j, 'nbLots') ?? 0,
        statut: _s(j, 'statut'),
        configJson: _map(j['configJson']),
        logoStoragePath: _sn(j, 'logoStoragePath'),
        photosJson: _map(j['photosJson']),
        delaiConvocationJours: _in(j, 'delaiConvocationJours'),
        totalTantiemes: _sn(j, 'totalTantiemes'),
        politiqueRecouvrementJson: _map(j['politiqueRecouvrementJson']),
        quorumPremiereConvocation: _sn(j, 'quorumPremiereConvocation'),
        limiteProcurationsMandataire: _in(j, 'limiteProcurationsMandataire'),
        retentionDesactivationMois: _in(j, 'retentionDesactivationMois'),
        creeLe: _s(j, 'creeLe'),
      );

  bool get locataireVoitPv => configJson?['locataire_voit_pv'] == true;
  bool get reservationProprietairesSeulement => configJson?['reservation_espaces_proprietaires_only'] == true;
}

class AdminSynthese {
  final int lots, residentsActifs, invitationsEnAttente, invitationsAcceptees, incidentsOuverts, slaDepasses, documents;
  final String montantDu, montantPaye;
  final Map<String, dynamic>? prochaineAg;
  final String? derniereActivite;
  const AdminSynthese({required this.lots, required this.residentsActifs, required this.invitationsEnAttente, required this.invitationsAcceptees, required this.incidentsOuverts, required this.slaDepasses, required this.documents, required this.montantDu, required this.montantPaye, this.prochaineAg, this.derniereActivite});
  factory AdminSynthese.fromJson(Map<String, dynamic> j) => AdminSynthese(
        lots: _in(j, 'lots') ?? 0,
        residentsActifs: _in(j, 'residents_actifs') ?? 0,
        invitationsEnAttente: _in(j, 'invitations_en_attente') ?? 0,
        invitationsAcceptees: _in(j, 'invitations_acceptees') ?? 0,
        incidentsOuverts: _in(j, 'incidents_ouverts') ?? 0,
        slaDepasses: _in(j, 'sla_depasses') ?? 0,
        documents: _in(j, 'documents') ?? 0,
        montantDu: _s(j, 'montant_du'),
        montantPaye: _s(j, 'montant_paye'),
        prochaineAg: _map(j['prochaine_ag']),
        derniereActivite: _sn(j, 'derniere_activite'),
      );
}

// ── Lots ────────────────────────────────────────────────────────────────────
class UtilisateurNom {
  final String id;
  final String? nom;
  final String? prenom;
  const UtilisateurNom({required this.id, this.nom, this.prenom});
  factory UtilisateurNom.fromJson(Map<String, dynamic> j) => UtilisateurNom(id: _s(j, 'id'), nom: _sn(j, 'nom'), prenom: _sn(j, 'prenom'));
}

class LotProprietaire {
  final String id, lotId, utilisateurId, quotePart, typePropriete, dateDebut;
  final bool estRepresentantIndivision;
  final String? dateFin;
  final UtilisateurNom? utilisateur;
  const LotProprietaire({required this.id, required this.lotId, required this.utilisateurId, required this.quotePart, required this.typePropriete, required this.estRepresentantIndivision, required this.dateDebut, this.dateFin, this.utilisateur});
  factory LotProprietaire.fromJson(Map<String, dynamic> j) => LotProprietaire(
        id: _s(j, 'id'), lotId: _s(j, 'lotId'), utilisateurId: _s(j, 'utilisateurId'), quotePart: _s(j, 'quotePart'),
        typePropriete: _s(j, 'typePropriete'), estRepresentantIndivision: _b(j, 'estRepresentantIndivision'),
        dateDebut: _s(j, 'dateDebut'), dateFin: _sn(j, 'dateFin'),
        utilisateur: _map(j['utilisateur']) == null ? null : UtilisateurNom.fromJson(_map(j['utilisateur'])!),
      );
  bool get actif => dateFin == null;
}

class LotOccupant {
  final String id, lotId, utilisateurId, typeOccupation, dateDebut;
  final String? dateFin;
  final bool accesFinancesAccorde, recoitConvocations;
  final UtilisateurNom? utilisateur;
  const LotOccupant({required this.id, required this.lotId, required this.utilisateurId, required this.typeOccupation, required this.dateDebut, this.dateFin, required this.accesFinancesAccorde, required this.recoitConvocations, this.utilisateur});
  factory LotOccupant.fromJson(Map<String, dynamic> j) => LotOccupant(
        id: _s(j, 'id'), lotId: _s(j, 'lotId'), utilisateurId: _s(j, 'utilisateurId'), typeOccupation: _s(j, 'typeOccupation'),
        dateDebut: _s(j, 'dateDebut'), dateFin: _sn(j, 'dateFin'), accesFinancesAccorde: _b(j, 'accesFinancesAccorde'),
        recoitConvocations: _b(j, 'recoitConvocations'),
        utilisateur: _map(j['utilisateur']) == null ? null : UtilisateurNom.fromJson(_map(j['utilisateur'])!),
      );
  bool get actif => dateFin == null;
}

class Lot {
  final String id, coproprieteId, typeLot, numero, tantiemes, statut, creeLe;
  final String? typeUsage, superficie, lotParentId;
  final int? etage;
  final List<LotProprietaire> proprietaires;
  final List<LotOccupant> occupants;
  const Lot({required this.id, required this.coproprieteId, required this.typeLot, this.typeUsage, required this.numero, this.etage, required this.tantiemes, this.superficie, required this.statut, this.lotParentId, required this.creeLe, this.proprietaires = const [], this.occupants = const []});
  factory Lot.fromJson(Map<String, dynamic> j) => Lot(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), typeLot: _s(j, 'typeLot'), typeUsage: _sn(j, 'typeUsage'),
        numero: _s(j, 'numero'), etage: _in(j, 'etage'), tantiemes: _s(j, 'tantiemes'), superficie: _sn(j, 'superficie'),
        statut: _s(j, 'statut'), lotParentId: _sn(j, 'lotParentId'), creeLe: _s(j, 'creeLe'),
        proprietaires: _list(j['proprietaires'], LotProprietaire.fromJson),
        occupants: _list(j['occupants'], LotOccupant.fromJson),
      );

  /// L'appelant est rattaché (propriétaire ou occupant actif) à ce lot.
  bool concerne(String utilisateurId) =>
      proprietaires.any((p) => p.actif && p.utilisateurId == utilisateurId) ||
      occupants.any((o) => o.actif && o.utilisateurId == utilisateurId);
  bool estProprietaire(String utilisateurId) => proprietaires.any((p) => p.actif && p.utilisateurId == utilisateurId);
}

// ── Invitations ─────────────────────────────────────────────────────────────
class Invitation {
  final String id, coproprieteId, roleCible, emetteurId, canal, code, statut, expireLe, creeLe;
  final String? lotId, ouverteLe;
  const Invitation({required this.id, required this.coproprieteId, this.lotId, required this.roleCible, required this.emetteurId, required this.canal, required this.code, required this.statut, required this.expireLe, this.ouverteLe, required this.creeLe});
  factory Invitation.fromJson(Map<String, dynamic> j) => Invitation(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), lotId: _sn(j, 'lotId'), roleCible: _s(j, 'roleCible'),
        emetteurId: _s(j, 'emetteurId'), canal: _s(j, 'canal'), code: _s(j, 'code'), statut: _s(j, 'statut'),
        expireLe: _s(j, 'expireLe'), ouverteLe: _sn(j, 'ouverteLe'), creeLe: _s(j, 'creeLe'),
      );
}

// ── Finances ────────────────────────────────────────────────────────────────
class BudgetAg {
  final String id, coproprieteId, exercice, montantTotal, statut, creeLe;
  final String? agId;
  const BudgetAg({required this.id, required this.coproprieteId, this.agId, required this.exercice, required this.montantTotal, required this.statut, required this.creeLe});
  factory BudgetAg.fromJson(Map<String, dynamic> j) => BudgetAg(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), agId: _sn(j, 'agId'), exercice: _s(j, 'exercice'),
        montantTotal: _s(j, 'montantTotal'), statut: _s(j, 'statut'), creeLe: _s(j, 'creeLe'),
      );
}

class AppelDeFondsLigne {
  final String id, appelDeFondsId, lotId, montantDu, montantPaye, statut, niveauEscalade, creeLe;
  final bool tropPercuAutorise, conteste;
  final String? derniereEscaladeLe;
  const AppelDeFondsLigne({required this.id, required this.appelDeFondsId, required this.lotId, required this.montantDu, required this.montantPaye, required this.statut, required this.tropPercuAutorise, required this.conteste, required this.niveauEscalade, this.derniereEscaladeLe, required this.creeLe});
  factory AppelDeFondsLigne.fromJson(Map<String, dynamic> j) => AppelDeFondsLigne(
        id: _s(j, 'id'), appelDeFondsId: _s(j, 'appelDeFondsId'), lotId: _s(j, 'lotId'), montantDu: _s(j, 'montantDu'),
        montantPaye: _s(j, 'montantPaye'), statut: _s(j, 'statut'), tropPercuAutorise: _b(j, 'tropPercuAutorise'),
        conteste: _b(j, 'conteste'), niveauEscalade: _s(j, 'niveauEscalade'), derniereEscaladeLe: _sn(j, 'derniereEscaladeLe'),
        creeLe: _s(j, 'creeLe'),
      );
}

class AppelDeFonds {
  final String id, coproprieteId, periode, type, montantTotal, dateEcheance, statut, creeLe;
  final List<AppelDeFondsLigne> lignes;
  const AppelDeFonds({required this.id, required this.coproprieteId, required this.periode, required this.type, required this.montantTotal, required this.dateEcheance, required this.statut, required this.creeLe, this.lignes = const []});
  factory AppelDeFonds.fromJson(Map<String, dynamic> j) => AppelDeFonds(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), periode: _s(j, 'periode'), type: _s(j, 'type'),
        montantTotal: _s(j, 'montantTotal'), dateEcheance: _s(j, 'dateEcheance'), statut: _s(j, 'statut'),
        creeLe: _s(j, 'creeLe'), lignes: _list(j['lignes'], AppelDeFondsLigne.fromJson),
      );
}

/// GET /finances/synthese — appels + lignes visibles par l'appelant (RLS).
class SyntheseFinanciere {
  final List<AppelDeFonds> appels;
  final List<AppelDeFondsLigne> lignes;
  const SyntheseFinanciere({this.appels = const [], this.lignes = const []});
  factory SyntheseFinanciere.fromJson(Map<String, dynamic> j) =>
      SyntheseFinanciere(appels: _list(j['appels'], AppelDeFonds.fromJson), lignes: _list(j['lignes'], AppelDeFondsLigne.fromJson));
}

class SoldeLigne {
  final String appelDeFondsLotId, montantDu, montantPaye, statut;
  final bool conteste;
  const SoldeLigne({required this.appelDeFondsLotId, required this.montantDu, required this.montantPaye, required this.statut, required this.conteste});
}

class SoldeLot {
  final String lotId, soldeDu;
  final List<SoldeLigne> lignes;
  const SoldeLot({required this.lotId, required this.soldeDu, required this.lignes});
  factory SoldeLot.fromJson(Map<String, dynamic> j) => SoldeLot(
        lotId: _s(j, 'lot_id'),
        soldeDu: _s(j, 'solde_du'),
        lignes: _list(j['lignes'], (l) => SoldeLigne(appelDeFondsLotId: _s(l, 'appel_de_fonds_lot_id'), montantDu: _s(l, 'montant_du'), montantPaye: _s(l, 'montant_paye'), statut: _s(l, 'statut'), conteste: _b(l, 'conteste'))),
      );
}

class Paiement {
  final String id, lotId, appelDeFondsLotId, montant, methode, statut, horodatage;
  final String? referenceCmi, payeurUtilisateurId;
  const Paiement({required this.id, required this.lotId, required this.appelDeFondsLotId, required this.montant, required this.methode, this.referenceCmi, required this.statut, this.payeurUtilisateurId, required this.horodatage});
  factory Paiement.fromJson(Map<String, dynamic> j) => Paiement(
        id: _s(j, 'id'), lotId: _s(j, 'lotId'), appelDeFondsLotId: _s(j, 'appelDeFondsLotId'), montant: _s(j, 'montant'),
        methode: _s(j, 'methode'), referenceCmi: _sn(j, 'referenceCmi'), statut: _s(j, 'statut'),
        payeurUtilisateurId: _sn(j, 'payeurUtilisateurId'), horodatage: _s(j, 'horodatage'),
      );
}

class Quittance {
  final String id, appelDeFondsLotId, numero, dateEmission;
  final String? pdfUrl;
  const Quittance({required this.id, required this.appelDeFondsLotId, this.pdfUrl, required this.numero, required this.dateEmission});
  factory Quittance.fromJson(Map<String, dynamic> j) => Quittance(
        id: _s(j, 'id'), appelDeFondsLotId: _s(j, 'appelDeFondsLotId'), pdfUrl: _sn(j, 'pdfUrl'), numero: _s(j, 'numero'), dateEmission: _s(j, 'dateEmission'),
      );
}

class Affectation {
  final String appelDeFondsLotId, montant, statut;
  const Affectation({required this.appelDeFondsLotId, required this.montant, required this.statut});
}

/// POST /finances/paiements — ciblé `{paiement, statut, quittance}` ou FIFO
/// `{lot_id, montant, affectations, quittance}`.
class PaiementResult {
  final bool fifo;
  final String? statut;
  final List<Affectation> affectations;
  final Quittance? quittance;
  const PaiementResult({required this.fifo, this.statut, this.affectations = const [], this.quittance});
  factory PaiementResult.fromJson(Map<String, dynamic> j) {
    final q = _map(j['quittance']);
    if (j.containsKey('affectations')) {
      return PaiementResult(
        fifo: true,
        affectations: _list(j['affectations'], (a) => Affectation(appelDeFondsLotId: _s(a, 'appel_de_fonds_lot_id'), montant: _s(a, 'montant'), statut: _s(a, 'statut'))),
        quittance: q == null ? null : Quittance.fromJson(q),
      );
    }
    return PaiementResult(fifo: false, statut: _sn(j, 'statut'), quittance: q == null ? null : Quittance.fromJson(q));
  }
}

class Contestation {
  final String id, appelDeFondsLotId, utilisateurId, motif, statut, creeLe;
  final String? reponseSyndic;
  const Contestation({required this.id, required this.appelDeFondsLotId, required this.utilisateurId, required this.motif, required this.statut, this.reponseSyndic, required this.creeLe});
  factory Contestation.fromJson(Map<String, dynamic> j) => Contestation(
        id: _s(j, 'id'), appelDeFondsLotId: _s(j, 'appelDeFondsLotId'), utilisateurId: _s(j, 'utilisateurId'), motif: _s(j, 'motif'),
        statut: _s(j, 'statut'), reponseSyndic: _sn(j, 'reponseSyndic'), creeLe: _s(j, 'creeLe'),
      );
}

// ── Assemblées générales ────────────────────────────────────────────────────
class AgResolution {
  final String id, agId, texte, typeMajorite, resultat;
  final int ordre;
  const AgResolution({required this.id, required this.agId, required this.ordre, required this.texte, required this.typeMajorite, required this.resultat});
  factory AgResolution.fromJson(Map<String, dynamic> j) => AgResolution(
        id: _s(j, 'id'), agId: _s(j, 'agId'), ordre: _in(j, 'ordre') ?? 0, texte: _s(j, 'texte'), typeMajorite: _s(j, 'typeMajorite'), resultat: _s(j, 'resultat'),
      );
}

class AssembleeGenerale {
  final String id, coproprieteId, type, dateAg, statut, creeLe;
  final String? dateConvocation, quorumRequis, quorumAtteint, motifAnnulation;
  final List<AgResolution> resolutions;
  const AssembleeGenerale({required this.id, required this.coproprieteId, required this.type, this.dateConvocation, required this.dateAg, required this.statut, this.quorumRequis, this.quorumAtteint, this.motifAnnulation, required this.creeLe, this.resolutions = const []});
  factory AssembleeGenerale.fromJson(Map<String, dynamic> j) => AssembleeGenerale(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), type: _s(j, 'type'), dateConvocation: _sn(j, 'dateConvocation'),
        dateAg: _s(j, 'dateAg'), statut: _s(j, 'statut'), quorumRequis: _sn(j, 'quorumRequis'), quorumAtteint: _sn(j, 'quorumAtteint'),
        motifAnnulation: _sn(j, 'motifAnnulation'), creeLe: _s(j, 'creeLe'), resolutions: _list(j['resolutions'], AgResolution.fromJson),
      );
  bool get aVenir => statut == 'PLANIFIEE' || statut == 'CONVOQUEE' || statut == 'EN_COURS';
}

class AgVote {
  final String id, resolutionId, lotId, utilisateurId, valeur, tantiemesRepresentes, horodatage;
  const AgVote({required this.id, required this.resolutionId, required this.lotId, required this.utilisateurId, required this.valeur, required this.tantiemesRepresentes, required this.horodatage});
  factory AgVote.fromJson(Map<String, dynamic> j) => AgVote(
        id: _s(j, 'id'), resolutionId: _s(j, 'resolutionId'), lotId: _s(j, 'lotId'), utilisateurId: _s(j, 'utilisateurId'),
        valeur: _s(j, 'valeur'), tantiemesRepresentes: _s(j, 'tantiemesRepresentes'), horodatage: _s(j, 'horodatage'),
      );
}

class AgResultatLigne {
  final String valeur, tantiemesTotal;
  final int nbVotants;
  const AgResultatLigne({required this.valeur, required this.nbVotants, required this.tantiemesTotal});
  factory AgResultatLigne.fromJson(Map<String, dynamic> j) =>
      AgResultatLigne(valeur: _s(j, 'valeur'), nbVotants: _in(j, 'nb_votants') ?? 0, tantiemesTotal: _s(j, 'tantiemes_total'));
}

class AgProcuration {
  final String id, agId, lotId, mandantId, mandataireId, creeLe;
  final String? revoqueeLe;
  const AgProcuration({required this.id, required this.agId, required this.lotId, required this.mandantId, required this.mandataireId, this.revoqueeLe, required this.creeLe});
  factory AgProcuration.fromJson(Map<String, dynamic> j) => AgProcuration(
        id: _s(j, 'id'), agId: _s(j, 'agId'), lotId: _s(j, 'lotId'), mandantId: _s(j, 'mandantId'), mandataireId: _s(j, 'mandataireId'),
        revoqueeLe: _sn(j, 'revoqueeLe'), creeLe: _s(j, 'creeLe'),
      );
  bool get active => revoqueeLe == null;
}

class AgPvResolution {
  final String id, texte, typeMajorite, resultat;
  final int ordre;
  const AgPvResolution({required this.id, required this.ordre, required this.texte, required this.typeMajorite, required this.resultat});
}

class AgPv {
  final String id, agId, hashIntegrite, horodatageGeneration;
  final String? pdfUrl, typeAg, dateAg, quorumRequis, quorumAtteint;
  final List<AgPvResolution> resolutions;
  const AgPv({required this.id, required this.agId, this.pdfUrl, required this.hashIntegrite, required this.horodatageGeneration, this.typeAg, this.dateAg, this.quorumRequis, this.quorumAtteint, this.resolutions = const []});
  factory AgPv.fromJson(Map<String, dynamic> j) {
    final c = _map(j['contenuJson']) ?? const {};
    return AgPv(
      id: _s(j, 'id'), agId: _s(j, 'agId'), pdfUrl: _sn(j, 'pdfUrl'), hashIntegrite: _s(j, 'hashIntegrite'),
      horodatageGeneration: _s(j, 'horodatageGeneration'), typeAg: _sn(c, 'type'), dateAg: _sn(c, 'date_ag'),
      quorumRequis: _sn(c, 'quorum_requis'), quorumAtteint: _sn(c, 'quorum_atteint'),
      resolutions: _list(c['resolutions'], (r) => AgPvResolution(id: _s(r, 'id'), ordre: _in(r, 'ordre') ?? 0, texte: _s(r, 'texte'), typeMajorite: _s(r, 'type_majorite'), resultat: _s(r, 'resultat'))),
    );
  }
}

// ── Incidents ───────────────────────────────────────────────────────────────
class IncidentActeur {
  final String id;
  final String? nom, prenom, telephone, email;
  const IncidentActeur({required this.id, this.nom, this.prenom, this.telephone, this.email});
  factory IncidentActeur.fromJson(Map<String, dynamic> j) =>
      IncidentActeur(id: _s(j, 'id'), nom: _sn(j, 'nom'), prenom: _sn(j, 'prenom'), telephone: _sn(j, 'telephone'), email: _sn(j, 'email'));
}

class IncidentLog {
  final String id, incidentId, statutApres, horodatage;
  final String? statutAvant, acteurId, commentaire;
  final IncidentActeur? acteur;
  const IncidentLog({required this.id, required this.incidentId, this.statutAvant, required this.statutApres, this.acteurId, this.acteur, this.commentaire, required this.horodatage});
  factory IncidentLog.fromJson(Map<String, dynamic> j) => IncidentLog(
        id: _s(j, 'id'), incidentId: _s(j, 'incidentId'), statutAvant: _sn(j, 'statutAvant'), statutApres: _s(j, 'statutApres'),
        acteurId: _sn(j, 'acteurId'), acteur: _map(j['acteur']) == null ? null : IncidentActeur.fromJson(_map(j['acteur'])!),
        commentaire: _sn(j, 'commentaire'), horodatage: _s(j, 'horodatage'),
      );
}

class Incident {
  final String id, coproprieteId, categorie, sousCategorie, partie, urgence, statut, creePar, creeLe, modifieLe;
  final String? lotId, description, assigneAId, slaDeadline;
  final List<String> photos;
  final List<IncidentLog> journal;
  final IncidentActeur? createur;
  // M16 — évaluation du prestataire (créateur du ticket ou syndic, après RESOLU/FERME) et
  // dépenses nées de l'incident (détail, rôles syndic/conseil uniquement).
  final int? notePrestataire;
  final String? commentairePrestataire, totalDepenses;
  final List<Depense> depenses;
  const Incident({required this.id, required this.coproprieteId, this.lotId, required this.categorie, required this.sousCategorie, this.description, required this.partie, required this.urgence, required this.statut, required this.creePar, this.assigneAId, this.slaDeadline, this.photos = const [], required this.creeLe, required this.modifieLe, this.journal = const [], this.createur, this.notePrestataire, this.commentairePrestataire, this.totalDepenses, this.depenses = const []});
  factory Incident.fromJson(Map<String, dynamic> j) => Incident(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), lotId: _sn(j, 'lotId'), categorie: _s(j, 'categorie'),
        sousCategorie: _s(j, 'sousCategorie'), description: _sn(j, 'description'), partie: _s(j, 'partie'), urgence: _s(j, 'urgence'),
        statut: _s(j, 'statut'), creePar: _s(j, 'creePar'), assigneAId: _sn(j, 'assigneAId'), slaDeadline: _sn(j, 'slaDeadline'),
        photos: (j['photos'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        creeLe: _s(j, 'creeLe'), modifieLe: _s(j, 'modifieLe'),
        journal: _list(j['journal'] ?? j['logs'], IncidentLog.fromJson),
        createur: _map(j['createur']) == null ? null : IncidentActeur.fromJson(_map(j['createur'])!),
        notePrestataire: _in(j, 'notePrestataire'), commentairePrestataire: _sn(j, 'commentairePrestataire'), totalDepenses: _sn(j, 'total_depenses'),
        depenses: _list(j['depenses'], Depense.fromJson),
      );
  bool get ouvert => statut == 'OUVERT' || statut == 'EN_COURS';
  bool get resolu => statut == 'RESOLU' || statut == 'FERME';
  bool get slaDepasse => ouvert && slaDeadline != null && (DateTime.tryParse(slaDeadline!)?.isBefore(DateTime.now()) ?? false);
}

class IncidentPhoto {
  final String path, url;
  const IncidentPhoto({required this.path, required this.url});
  factory IncidentPhoto.fromJson(Map<String, dynamic> j) => IncidentPhoto(path: _s(j, 'path'), url: _s(j, 'url'));
}

class Prestataire {
  final String id, coproprieteId, nom, specialite, contact, creeLe;
  final bool actif;
  final String? utilisateurId;
  // M16 — fiche fournisseur (le RIB complet n'est jamais dans une réponse de liste/fiche).
  final String? telephone, email, ice, adresse, ribMasque, noteMoyenne;
  const Prestataire({required this.id, required this.coproprieteId, required this.nom, required this.specialite, required this.contact, required this.actif, this.utilisateurId, required this.creeLe, this.telephone, this.email, this.ice, this.adresse, this.ribMasque, this.noteMoyenne});
  factory Prestataire.fromJson(Map<String, dynamic> j) => Prestataire(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), nom: _s(j, 'nom'), specialite: _s(j, 'specialite'), contact: _s(j, 'contact'),
        actif: _b(j, 'actif', true), utilisateurId: _sn(j, 'utilisateurId'), creeLe: _s(j, 'creeLe'),
        telephone: _sn(j, 'telephone'), email: _sn(j, 'email'), ice: _sn(j, 'ice'), adresse: _sn(j, 'adresse'), ribMasque: _sn(j, 'ribMasque'), noteMoyenne: _sn(j, 'noteMoyenne'),
      );
  /// Numéro à composer : téléphone structuré, sinon `contact` s'il ressemble à un numéro.
  String? get telephoneAppel {
    final t = telephone ?? contact;
    return RegExp(r'^\+?\d{8,}$').hasMatch(t.replaceAll(RegExp(r'[\s.-]'), '')) ? t.replaceAll(RegExp(r'[\s.-]'), '') : null;
  }
}

// ── M16 — Dépenses, factures, postes budgétaires ────────────────────────────
class DepenseRef {
  final String id, nom;
  const DepenseRef({required this.id, required this.nom});
}

class Facture {
  final String id, depenseId, dateFacture, montantTtc, statut, documentId, creeLe;
  final String? numero, dateEcheance, documentNom;
  const Facture({required this.id, required this.depenseId, this.numero, required this.dateFacture, this.dateEcheance, required this.montantTtc, required this.statut, required this.documentId, required this.creeLe, this.documentNom});
  factory Facture.fromJson(Map<String, dynamic> j) => Facture(
        id: _s(j, 'id'), depenseId: _s(j, 'depenseId'), numero: _sn(j, 'numero'), dateFacture: _s(j, 'dateFacture'), dateEcheance: _sn(j, 'dateEcheance'),
        montantTtc: _s(j, 'montantTtc'), statut: _s(j, 'statut'), documentId: _s(j, 'documentId'), creeLe: _s(j, 'creeLe'),
        documentNom: _map(j['document'])?['nom']?.toString(),
      );
}

class DepenseLog {
  final String id, type, horodatage;
  final String? acteurNom;
  final Map<String, dynamic> details;
  const DepenseLog({required this.id, required this.type, required this.horodatage, this.acteurNom, this.details = const {}});
  factory DepenseLog.fromJson(Map<String, dynamic> j) {
    final a = _map(j['acteur']);
    final nom = a == null ? null : [a['prenom'], a['nom']].whereType<String>().where((x) => x.isNotEmpty).join(' ');
    return DepenseLog(id: _s(j, 'id'), type: _s(j, 'type'), horodatage: _s(j, 'horodatage'), acteurNom: (nom == null || nom.isEmpty) ? null : nom, details: _map(j['detailsJson']) ?? const {});
  }
}

class Depense {
  final String id, coproprieteId, categorie, libelle, montantTtc, dateDepense, statut, source, creeParId, creeLe;
  final String? description, montantHt, tva, budgetPosteId, prestataireId, incidentId, resolutionAgId, approuveParId, approuveLe, motifRejet, payeLe, methodePaiement, referencePaiement, justificatifPaiementDocumentId;
  final DepenseRef? prestataire, budgetPoste, incident, creePar, approuvePar;
  final List<Facture> factures;
  final List<DepenseLog> logs;
  final int nbFactures;
  final String? mouvementReserve; // montant (négatif) du mouvement de réserve si payée depuis la réserve
  final String? niveauApprobationRequis; // SYNDIC | CONSEIL (détail uniquement)
  final bool seuilNonConfigure;
  const Depense({required this.id, required this.coproprieteId, required this.categorie, required this.libelle, required this.montantTtc, required this.dateDepense, required this.statut, required this.source, required this.creeParId, required this.creeLe, this.description, this.montantHt, this.tva, this.budgetPosteId, this.prestataireId, this.incidentId, this.resolutionAgId, this.approuveParId, this.approuveLe, this.motifRejet, this.payeLe, this.methodePaiement, this.referencePaiement, this.justificatifPaiementDocumentId, this.prestataire, this.budgetPoste, this.incident, this.creePar, this.approuvePar, this.factures = const [], this.logs = const [], this.nbFactures = 0, this.mouvementReserve, this.niveauApprobationRequis, this.seuilNonConfigure = false});
  static DepenseRef? _ref(dynamic v, String champNom) {
    final m = _map(v);
    if (m == null) return null;
    final nom = champNom == 'personne' ? [m['prenom'], m['nom']].whereType<String>().where((x) => x.isNotEmpty).join(' ') : (m[champNom] ?? '').toString();
    return DepenseRef(id: (m['id'] ?? '').toString(), nom: nom);
  }
  factory Depense.fromJson(Map<String, dynamic> j) {
    final mouvements = (j['mouvementsFondsReserve'] as List?)?.whereType<Map>().toList() ?? const [];
    return Depense(
      id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), categorie: _s(j, 'categorie'), libelle: _s(j, 'libelle'), montantTtc: _s(j, 'montantTtc'),
      dateDepense: _s(j, 'dateDepense'), statut: _s(j, 'statut'), source: _s(j, 'source'), creeParId: _s(j, 'creeParId'), creeLe: _s(j, 'creeLe'),
      description: _sn(j, 'description'), montantHt: _sn(j, 'montantHt'), tva: _sn(j, 'tva'), budgetPosteId: _sn(j, 'budgetPosteId'), prestataireId: _sn(j, 'prestataireId'),
      incidentId: _sn(j, 'incidentId'), resolutionAgId: _sn(j, 'resolutionAgId'), approuveParId: _sn(j, 'approuveParId'), approuveLe: _sn(j, 'approuveLe'), motifRejet: _sn(j, 'motifRejet'),
      payeLe: _sn(j, 'payeLe'), methodePaiement: _sn(j, 'methodePaiement'), referencePaiement: _sn(j, 'referencePaiement'), justificatifPaiementDocumentId: _sn(j, 'justificatifPaiementDocumentId'),
      prestataire: _ref(j['prestataire'], 'nom'), budgetPoste: _ref(j['budgetPoste'], 'libelle'), incident: _ref(j['incident'], 'sousCategorie'),
      creePar: _ref(j['creePar'], 'personne'), approuvePar: _ref(j['approuvePar'], 'personne'),
      factures: _list(j['factures'], Facture.fromJson), logs: _list(j['logs'], DepenseLog.fromJson),
      nbFactures: (_map(j['_count'])?['factures'] as num?)?.toInt() ?? 0,
      mouvementReserve: mouvements.isEmpty ? null : mouvements.first['montant']?.toString(),
      niveauApprobationRequis: _sn(j, 'niveau_approbation_requis'), seuilNonConfigure: _b(j, 'seuil_non_configure'),
    );
  }
  bool get payee => statut == 'PAYEE';
  bool get modifiable => statut == 'BROUILLON' || statut == 'REJETEE';
}

class DepenseDocument {
  final String url, nom;
  final String? factureId, numero, statut;
  const DepenseDocument({required this.url, required this.nom, this.factureId, this.numero, this.statut});
  factory DepenseDocument.fromJson(Map<String, dynamic> j) => DepenseDocument(url: _s(j, 'url'), nom: _s(j, 'nom'), factureId: _sn(j, 'facture_id'), numero: _sn(j, 'numero'), statut: _sn(j, 'statut'));
}

class DepenseDocuments {
  final List<DepenseDocument> factures;
  final DepenseDocument? justificatif;
  const DepenseDocuments({this.factures = const [], this.justificatif});
  factory DepenseDocuments.fromJson(Map<String, dynamic> j) => DepenseDocuments(
        factures: _list(j['factures'], DepenseDocument.fromJson),
        justificatif: _map(j['justificatif_paiement']) == null ? null : DepenseDocument.fromJson(_map(j['justificatif_paiement'])!),
      );
}

class BudgetVsRealiseLigne {
  final String? posteId, libelle, montantPrevu, ecart, pourcentageConsomme;
  final String categorie, enAttente, engage, realise, consomme;
  final bool depassement;
  final int nbDepenses;
  const BudgetVsRealiseLigne({this.posteId, this.libelle, required this.categorie, this.montantPrevu, required this.enAttente, required this.engage, required this.realise, required this.consomme, this.ecart, this.pourcentageConsomme, required this.depassement, required this.nbDepenses});
  factory BudgetVsRealiseLigne.fromJson(Map<String, dynamic> j) => BudgetVsRealiseLigne(
        posteId: _sn(j, 'poste_id'), libelle: _sn(j, 'libelle'), categorie: _s(j, 'categorie'), montantPrevu: _sn(j, 'montant_prevu'), enAttente: _s(j, 'en_attente'), engage: _s(j, 'engage'),
        realise: _s(j, 'realise'), consomme: _s(j, 'consomme'), ecart: _sn(j, 'ecart'), pourcentageConsomme: _sn(j, 'pourcentage_consomme'), depassement: _b(j, 'depassement'), nbDepenses: _in(j, 'nb_depenses') ?? 0,
      );
}

class BudgetVsRealise {
  final String exercice, reserveSolde, impayesTotal;
  final String? budgetId, budgetMontantTotal, seuilApprobationConseil;
  final bool seuilNonConfigure;
  final int nbAApprouver;
  final BudgetVsRealiseLigne totaux;
  final List<BudgetVsRealiseLigne> postes, horsPoste;
  const BudgetVsRealise({required this.exercice, this.budgetId, this.budgetMontantTotal, required this.totaux, this.postes = const [], this.horsPoste = const [], required this.reserveSolde, required this.impayesTotal, this.seuilApprobationConseil, required this.seuilNonConfigure, required this.nbAApprouver});
  factory BudgetVsRealise.fromJson(Map<String, dynamic> j) {
    final b = _map(j['budget']);
    return BudgetVsRealise(
      exercice: _s(j, 'exercice'), budgetId: b?['id']?.toString(), budgetMontantTotal: b?['montant_total']?.toString(),
      totaux: BudgetVsRealiseLigne.fromJson(_map(j['totaux']) ?? const {}), postes: _list(j['postes'], BudgetVsRealiseLigne.fromJson), horsPoste: _list(j['hors_poste'], BudgetVsRealiseLigne.fromJson),
      reserveSolde: (_map(j['fonds_reserve'])?['solde'] ?? '0.00').toString(), impayesTotal: _s(j, 'impayes_total'),
      seuilApprobationConseil: _sn(j, 'seuil_approbation_conseil'), seuilNonConfigure: _b(j, 'seuil_non_configure'), nbAApprouver: _in(j, 'nb_a_approuver') ?? 0,
    );
  }
}

// ── Personnel & visites ─────────────────────────────────────────────────────
class Personnel {
  final String id, utilisateurId, coproprieteId, statut, creeLe;
  final String? logementLotId;
  const Personnel({required this.id, required this.utilisateurId, required this.coproprieteId, required this.statut, this.logementLotId, required this.creeLe});
  factory Personnel.fromJson(Map<String, dynamic> j) => Personnel(
        id: _s(j, 'id'), utilisateurId: _s(j, 'utilisateurId'), coproprieteId: _s(j, 'coproprieteId'), statut: _s(j, 'statut'),
        logementLotId: _sn(j, 'logementLotId'), creeLe: _s(j, 'creeLe'),
      );
}

class Visite {
  final String id, coproprieteId, gardienId, lotId, visiteurNom, statut, horodatage;
  const Visite({required this.id, required this.coproprieteId, required this.gardienId, required this.lotId, required this.visiteurNom, required this.statut, required this.horodatage});
  factory Visite.fromJson(Map<String, dynamic> j) => Visite(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), gardienId: _s(j, 'gardienId'), lotId: _s(j, 'lotId'),
        visiteurNom: _s(j, 'visiteurNom'), statut: _s(j, 'statut'), horodatage: _s(j, 'horodatage'),
      );
}

// ── Espaces communs ─────────────────────────────────────────────────────────
class EspaceCommun {
  final String id, coproprieteId, nom, type;
  final int? capacite;
  final bool reservable, validationAutomatique;
  final Map<String, dynamic>? reglesReservationJson;
  const EspaceCommun({required this.id, required this.coproprieteId, required this.nom, required this.type, this.capacite, required this.reservable, this.reglesReservationJson, required this.validationAutomatique});
  factory EspaceCommun.fromJson(Map<String, dynamic> j) => EspaceCommun(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), nom: _s(j, 'nom'), type: _s(j, 'type'), capacite: _in(j, 'capacite'),
        reservable: _b(j, 'reservable', true), reglesReservationJson: _map(j['reglesReservationJson']), validationAutomatique: _b(j, 'validationAutomatique'),
      );
}

class Reservation {
  final String id, espaceId, lotId, utilisateurId, dateDebut, dateFin, statut, creeLe;
  final int? nombreInvites;
  final String? motifRejet;
  const Reservation({required this.id, required this.espaceId, required this.lotId, required this.utilisateurId, required this.dateDebut, required this.dateFin, required this.statut, this.nombreInvites, this.motifRejet, required this.creeLe});
  factory Reservation.fromJson(Map<String, dynamic> j) => Reservation(
        id: _s(j, 'id'), espaceId: _s(j, 'espaceId'), lotId: _s(j, 'lotId'), utilisateurId: _s(j, 'utilisateurId'), dateDebut: _s(j, 'dateDebut'),
        dateFin: _s(j, 'dateFin'), statut: _s(j, 'statut'), nombreInvites: _in(j, 'nombreInvites'), motifRejet: _sn(j, 'motifRejet'), creeLe: _s(j, 'creeLe'),
      );
}

// ── Documents & notifications ───────────────────────────────────────────────
class DocumentCopro {
  final String id, coproprieteId, type, nom, visibilite, storagePath, creePar, creeLe;
  const DocumentCopro({required this.id, required this.coproprieteId, required this.type, required this.nom, required this.visibilite, required this.storagePath, required this.creePar, required this.creeLe});
  factory DocumentCopro.fromJson(Map<String, dynamic> j) => DocumentCopro(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), type: _s(j, 'type'), nom: _s(j, 'nom'), visibilite: _s(j, 'visibilite'),
        storagePath: _s(j, 'storagePath'), creePar: _s(j, 'creePar'), creeLe: _s(j, 'creeLe'),
      );
}

class NotificationItem {
  final String id, coproprieteId, utilisateurId, templateCode, canal, statutEnvoi, horodatageEnvoi;
  final Map<String, dynamic>? contenuJson;
  final String? titre, corps, luLe;
  final bool lu;
  const NotificationItem({required this.id, required this.coproprieteId, required this.utilisateurId, required this.templateCode, required this.canal, required this.statutEnvoi, this.contenuJson, this.titre, this.corps, required this.lu, this.luLe, required this.horodatageEnvoi});
  factory NotificationItem.fromJson(Map<String, dynamic> j) {
    final rendu = _map(j['rendu']);
    return NotificationItem(
      id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), utilisateurId: _s(j, 'utilisateurId'), templateCode: _s(j, 'templateCode'),
      canal: _s(j, 'canal'), statutEnvoi: _s(j, 'statutEnvoi'), contenuJson: _map(j['contenuJson']),
      titre: rendu == null ? _sn(j, 'titre') : _sn(rendu, 'titre'), corps: rendu == null ? _sn(j, 'corps') : _sn(rendu, 'corps'),
      lu: _b(j, 'lu'), luLe: _sn(j, 'luLe'), horodatageEnvoi: _s(j, 'horodatageEnvoi'),
    );
  }
  NotificationItem copyWith({bool? lu}) => NotificationItem(
        id: id, coproprieteId: coproprieteId, utilisateurId: utilisateurId, templateCode: templateCode, canal: canal, statutEnvoi: statutEnvoi,
        contenuJson: contenuJson, titre: titre, corps: corps, lu: lu ?? this.lu, luLe: luLe, horodatageEnvoi: horodatageEnvoi,
      );
}

// ── Litiges ─────────────────────────────────────────────────────────────────
class Litige {
  final String id, coproprieteId, type, description, statut, creePar, creeLe, modifieLe;
  final int escaladeNiveau;
  const Litige({required this.id, required this.coproprieteId, required this.type, required this.description, required this.statut, required this.escaladeNiveau, required this.creePar, required this.creeLe, required this.modifieLe});
  factory Litige.fromJson(Map<String, dynamic> j) => Litige(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), type: _s(j, 'type'), description: _s(j, 'description'), statut: _s(j, 'statut'),
        escaladeNiveau: _in(j, 'escaladeNiveau') ?? 0, creePar: _s(j, 'creePar'), creeLe: _s(j, 'creeLe'), modifieLe: _s(j, 'modifieLe'),
      );
}

// ── M15 Location courte durée (Doc A §10.2) ─────────────────────────────────
/// Paramètres du régime ENCADREE — clés snake_case dans le JSON (règlement de la copropriété).
class LcdParametres {
  final bool declarationPrealableObligatoire, gestionnaireObligatoireSiProprietaireAbsent, contactGardienObligatoire;
  final int? delaiDeclarationHeures, nbNuitsMaxParAn, nbVoyageursMaxParLot;
  const LcdParametres({this.declarationPrealableObligatoire = true, this.delaiDeclarationHeures, this.nbNuitsMaxParAn, this.nbVoyageursMaxParLot, this.gestionnaireObligatoireSiProprietaireAbsent = false, this.contactGardienObligatoire = true});
  factory LcdParametres.fromJson(Map<String, dynamic> j) => LcdParametres(
        declarationPrealableObligatoire: _b(j, 'declaration_prealable_obligatoire', true),
        delaiDeclarationHeures: _in(j, 'delai_declaration_heures'),
        nbNuitsMaxParAn: _in(j, 'nb_nuits_max_par_an'),
        nbVoyageursMaxParLot: _in(j, 'nb_voyageurs_max_par_lot'),
        gestionnaireObligatoireSiProprietaireAbsent: _b(j, 'gestionnaire_obligatoire_si_proprietaire_absent'),
        contactGardienObligatoire: _b(j, 'contact_gardien_obligatoire', true),
      );
  Map<String, dynamic> toJson() => {
        'declaration_prealable_obligatoire': declarationPrealableObligatoire,
        'delai_declaration_heures': delaiDeclarationHeures,
        'nb_nuits_max_par_an': nbNuitsMaxParAn,
        'nb_voyageurs_max_par_lot': nbVoyageursMaxParLot,
        'gestionnaire_obligatoire_si_proprietaire_absent': gestionnaireObligatoireSiProprietaireAbsent,
        'contact_gardien_obligatoire': contactGardienObligatoire,
      };
}

class LcdReglement {
  final String regimeLcd; // NON_DEFINI | AUTORISEE | ENCADREE | INTERDITE
  final LcdParametres? parametres;
  final String? regimeLcdAgResolutionId;
  final Map<String, dynamic>? agResolution;
  const LcdReglement({required this.regimeLcd, this.parametres, this.regimeLcdAgResolutionId, this.agResolution});
  factory LcdReglement.fromJson(Map<String, dynamic> j) => LcdReglement(
        regimeLcd: j['regimeLcd'] == null ? 'NON_DEFINI' : _s(j, 'regimeLcd'),
        parametres: _map(j['parametresLcdJson']) == null ? null : LcdParametres.fromJson(_map(j['parametresLcdJson'])!),
        regimeLcdAgResolutionId: _sn(j, 'regimeLcdAgResolutionId'),
        agResolution: _map(j['agResolution']),
      );
  bool get autorise => regimeLcd == 'AUTORISEE' || regimeLcd == 'ENCADREE';
}

class LcdLotRef {
  final String id, numero, typeLot;
  const LcdLotRef({required this.id, required this.numero, required this.typeLot});
  factory LcdLotRef.fromJson(Map<String, dynamic> j) => LcdLotRef(id: _s(j, 'id'), numero: _s(j, 'numero'), typeLot: _s(j, 'typeLot'));
}

class LcdDeclaration {
  final String id, coproprieteId, lotId, declareParId, statut, dateDebut, creeLe, modifieLe;
  final LcdLotRef? lot;
  final String? gestionnaireId, contactUrgenceNom, contactUrgenceTelephone, motifDecision, decideParId, decideLe, dateFin;
  final List<String>? plateformes;
  final List<LcdSejour> sejours;
  const LcdDeclaration({required this.id, required this.coproprieteId, required this.lotId, this.lot, required this.declareParId, this.gestionnaireId, this.plateformes, this.contactUrgenceNom, this.contactUrgenceTelephone, required this.statut, this.motifDecision, this.decideParId, this.decideLe, required this.dateDebut, this.dateFin, required this.creeLe, required this.modifieLe, this.sejours = const []});
  factory LcdDeclaration.fromJson(Map<String, dynamic> j) => LcdDeclaration(
        id: _s(j, 'id'), coproprieteId: _s(j, 'coproprieteId'), lotId: _s(j, 'lotId'),
        lot: _map(j['lot']) == null ? null : LcdLotRef.fromJson(_map(j['lot'])!),
        declareParId: _s(j, 'declareParId'), gestionnaireId: _sn(j, 'gestionnaireId'),
        plateformes: (j['plateformesJson'] as List?)?.map((e) => e.toString()).toList(),
        contactUrgenceNom: _sn(j, 'contactUrgenceNom'), contactUrgenceTelephone: _sn(j, 'contactUrgenceTelephone'),
        statut: _s(j, 'statut'), motifDecision: _sn(j, 'motifDecision'), decideParId: _sn(j, 'decideParId'), decideLe: _sn(j, 'decideLe'),
        dateDebut: _s(j, 'dateDebut'), dateFin: _sn(j, 'dateFin'), creeLe: _s(j, 'creeLe'), modifieLe: _s(j, 'modifieLe'),
        sejours: _list(j['sejours'], LcdSejour.fromJson),
      );
  bool get ouverte => statut == 'EN_ATTENTE' || statut == 'VALIDEE' || statut == 'SUSPENDUE';
  String get lotNumero => lot?.numero ?? lotId.substring(0, 8);
}

class LcdSejourEvenement {
  final String id, type, horodatage;
  final String? acteurId;
  final Map<String, dynamic>? detailsJson;
  const LcdSejourEvenement({required this.id, required this.type, this.acteurId, this.detailsJson, required this.horodatage});
  factory LcdSejourEvenement.fromJson(Map<String, dynamic> j) =>
      LcdSejourEvenement(id: _s(j, 'id'), type: _s(j, 'type'), acteurId: _sn(j, 'acteurId'), detailsJson: _map(j['detailsJson']), horodatage: _s(j, 'horodatage'));
}

class LcdSejour {
  final String id, lotId, declarationLcdId, declareParId, dateArrivee, dateDepart, voyageurPrincipalNom, statut, creeLe, modifieLe;
  final LcdLotRef? lot;
  final int nbVoyageurs;
  final String? heureArriveePrevue, voyageurTelephone, voyageurNationalite, pieceIdentiteType, pieceIdentiteFin, plaqueVehicule, annuleLe, motifAnnulation, gardienInformeLe;
  final List<LcdSejourEvenement> evenements;
  /// Chemins storage des pièces jointes (lecture via /lcd/sejours/{id}/pieces-jointes).
  final List<String> piecesJointes;
  const LcdSejour({required this.id, required this.lotId, this.lot, required this.declarationLcdId, required this.declareParId, required this.dateArrivee, required this.dateDepart, this.heureArriveePrevue, required this.nbVoyageurs, required this.voyageurPrincipalNom, this.voyageurTelephone, this.voyageurNationalite, this.pieceIdentiteType, this.pieceIdentiteFin, this.plaqueVehicule, required this.statut, this.annuleLe, this.motifAnnulation, this.gardienInformeLe, required this.creeLe, required this.modifieLe, this.evenements = const [], this.piecesJointes = const []});
  factory LcdSejour.fromJson(Map<String, dynamic> j) => LcdSejour(
        piecesJointes: (j['piecesJointes'] is List) ? (j['piecesJointes'] as List).whereType<String>().toList() : const [],
        id: _s(j, 'id'), lotId: _s(j, 'lotId'), lot: _map(j['lot']) == null ? null : LcdLotRef.fromJson(_map(j['lot'])!),
        declarationLcdId: _s(j, 'declarationLcdId'), declareParId: _s(j, 'declareParId'),
        dateArrivee: _s(j, 'dateArrivee'), dateDepart: _s(j, 'dateDepart'), heureArriveePrevue: _sn(j, 'heureArriveePrevue'),
        nbVoyageurs: _in(j, 'nbVoyageurs') ?? 1, voyageurPrincipalNom: _s(j, 'voyageurPrincipalNom'), voyageurTelephone: _sn(j, 'voyageurTelephone'),
        voyageurNationalite: _sn(j, 'voyageurNationalite'), pieceIdentiteType: _sn(j, 'pieceIdentiteType'), pieceIdentiteFin: _sn(j, 'pieceIdentiteFin'),
        plaqueVehicule: _sn(j, 'plaqueVehicule'), statut: _s(j, 'statut'), annuleLe: _sn(j, 'annuleLe'), motifAnnulation: _sn(j, 'motifAnnulation'),
        gardienInformeLe: _sn(j, 'gardienInformeLe'), creeLe: _s(j, 'creeLe'), modifieLe: _s(j, 'modifieLe'),
        evenements: _list(j['evenements'], LcdSejourEvenement.fromJson),
      );
  /// Jour civil « YYYY-MM-DD » (les dates de séjour sont des dates sans heure côté API).
  String get jourArrivee => dateArrivee.length >= 10 ? dateArrivee.substring(0, 10) : dateArrivee;
  String get jourDepart => dateDepart.length >= 10 ? dateDepart.substring(0, 10) : dateDepart;
  String get lotNumero => lot?.numero ?? lotId.substring(0, 8);
  bool get actif => statut == 'PREVU' || statut == 'EN_COURS';
  int get nuits {
    final a = DateTime.tryParse(jourArrivee);
    final d = DateTime.tryParse(jourDepart);
    if (a == null || d == null) return 0;
    final n = d.difference(a).inDays;
    return n < 0 ? 0 : n;
  }
  Map<String, dynamic> toJson() => {
        'id': id, 'lotId': lotId, 'lot': lot == null ? null : {'id': lot!.id, 'numero': lot!.numero, 'typeLot': lot!.typeLot},
        'declarationLcdId': declarationLcdId, 'declareParId': declareParId, 'dateArrivee': dateArrivee, 'dateDepart': dateDepart,
        'heureArriveePrevue': heureArriveePrevue, 'nbVoyageurs': nbVoyageurs, 'voyageurPrincipalNom': voyageurPrincipalNom,
        'voyageurTelephone': voyageurTelephone, 'voyageurNationalite': voyageurNationalite, 'pieceIdentiteType': pieceIdentiteType,
        'pieceIdentiteFin': pieceIdentiteFin, 'plaqueVehicule': plaqueVehicule, 'statut': statut, 'annuleLe': annuleLe,
        'motifAnnulation': motifAnnulation, 'gardienInformeLe': gardienInformeLe, 'creeLe': creeLe, 'modifieLe': modifieLe,
      };
}

/// Tableau du jour (gardien / syndic) : arrivées prévues, départs attendus, séjours en cours.
class LcdDuJour {
  final String date;
  final List<LcdSejour> arrivees, departs, enCours;
  const LcdDuJour({required this.date, this.arrivees = const [], this.departs = const [], this.enCours = const []});
  factory LcdDuJour.fromJson(Map<String, dynamic> j) => LcdDuJour(
        date: _s(j, 'date'), arrivees: _list(j['arrivees'], LcdSejour.fromJson), departs: _list(j['departs'], LcdSejour.fromJson), enCours: _list(j['enCours'], LcdSejour.fromJson),
      );
  Map<String, dynamic> toJson() => {'date': date, 'arrivees': arrivees.map((s) => s.toJson()).toList(), 'departs': departs.map((s) => s.toJson()).toList(), 'enCours': enCours.map((s) => s.toJson()).toList()};
  bool get vide => arrivees.isEmpty && departs.isEmpty && enCours.isEmpty;
}

class LcdSynthese {
  final LcdLotRef lot;
  final String regimeLcd;
  final LcdDeclaration? declaration;
  final int annee, nuitsUtilisees, incidentsLies;
  final int? nuitsQuota;
  final List<LcdSejour> derniersSejours;
  const LcdSynthese({required this.lot, required this.regimeLcd, this.declaration, required this.annee, required this.nuitsUtilisees, this.nuitsQuota, this.derniersSejours = const [], required this.incidentsLies});
  factory LcdSynthese.fromJson(Map<String, dynamic> j) => LcdSynthese(
        lot: LcdLotRef.fromJson(_map(j['lot']) ?? const {}), regimeLcd: _s(j, 'regimeLcd'),
        declaration: _map(j['declaration']) == null ? null : LcdDeclaration.fromJson(_map(j['declaration'])!),
        annee: _in(j, 'annee') ?? DateTime.now().year, nuitsUtilisees: _in(j, 'nuitsUtilisees') ?? 0, nuitsQuota: _in(j, 'nuitsQuota'),
        derniersSejours: _list(j['derniersSejours'], LcdSejour.fromJson), incidentsLies: _in(j, 'incidentsLies') ?? 0,
      );
}

/// Résultat de la désignation d'un gestionnaire : déclaration mise à jour + invitation M2 (si
/// la personne n'a pas encore de compte).
class LcdGestionnaireResult {
  final LcdDeclaration declaration;
  final Invitation? invitation;
  const LcdGestionnaireResult({required this.declaration, this.invitation});
  factory LcdGestionnaireResult.fromJson(Map<String, dynamic> j) => LcdGestionnaireResult(
        declaration: LcdDeclaration.fromJson(_map(j['declaration']) ?? const {}),
        invitation: _map(j['invitation']) == null ? null : Invitation.fromJson(_map(j['invitation'])!),
      );
}

/// Pièce jointe d'un séjour LCD — URL signée 15 min (image ou PDF).
class LcdPieceJointe {
  final String path, url, nom, type;
  const LcdPieceJointe({required this.path, required this.url, required this.nom, required this.type});
  factory LcdPieceJointe.fromJson(Map<String, dynamic> j) => LcdPieceJointe(path: _s(j, 'path'), url: _s(j, 'url'), nom: _s(j, 'nom'), type: _s(j, 'type'));
  bool get estImage => type == 'IMAGE';
}
