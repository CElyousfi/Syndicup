/**
 * Types des réponses RÉELLES de l'API (source : le code des routes/services, PAS l'openapi.yaml
 * qui décrit du snake_case aspirationnel — voir scratchpad api-shapes de la session de build).
 * Règles de sérialisation :
 *  - Prisma Decimal → string décimale NORMALISÉE ("300", "1200.5") sauf les endpoints passés par
 *    toApiString (solde, affectations FIFO) qui garantissent 2 décimales ("700.00").
 *  - DateTime → ISO 8601 UTC. Les colonnes date sortent aussi en ISO complet (minuit UTC).
 *  - Enums → SCREAMING_SNAKE_CASE.
 */

// ── Enveloppes ──────────────────────────────────────────────────────────────
export interface ApiMeta {
  request_id: string;
  total?: number;
  page?: number;
  has_more?: boolean;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export type ApiResult<T> =
  | { ok: true; data: T; meta: ApiMeta; status: number }
  | { ok: false; error: ApiError; status: number; requestId?: string; retryAfter?: number };

// ── Enums ───────────────────────────────────────────────────────────────────
export type RoleType =
  | "SUPER_ADMIN"
  | "SYNDIC"
  | "CONSEIL_SYNDICAL"
  | "PROPRIETAIRE"
  | "LOCATAIRE"
  | "INDIVISAIRE"
  | "GARDIEN"
  | "PRESTATAIRE"
  | "PERSONNE_MORALE_REPRESENTANT";

export type StatutCompte =
  | "INVITE"
  | "EN_VALIDATION"
  | "ACTIF"
  | "SUSPENDU"
  | "DESACTIVE"
  | "ANONYMISE";

export type TypeLot =
  | "APPARTEMENT"
  | "PARKING"
  | "CAVE"
  | "LOCAL"
  | "TOIT_TERRASSE"
  | "VILLA"
  | "COMMERCIAL"
  | "BUREAU"
  | "LOGE_GARDIEN";

export type StatutLot =
  | "OCCUPE"
  | "VACANT"
  | "ORPHELIN"
  | "EN_SUCCESSION"
  | "SINISTRE"
  | "TANTIEME_A_REGULARISER";

export type TypeResidence =
  | "IMMEUBLE_COLLECTIF"
  | "RESIDENCE_FERMEE"
  | "RESIDENCE_VILLAS"
  | "IMMEUBLE_BUREAUX"
  | "IMMEUBLE_MIXTE"
  | "RESIDENCE_ETUDIANTE";

export type TypeAppelDeFonds =
  | "CHARGES_COURANTES"
  | "EXCEPTIONNEL"
  | "FONDS_RESERVE"
  | "REGULARISATION"
  | "URGENCE"
  | "DEMARRAGE";

export type StatutLigneAppel = "PAYE" | "PARTIEL" | "IMPAYE";
export type NiveauEscalade = "N0" | "N1" | "N2" | "N3" | "N4" | "N5" | "N6";
export type StatutBudget = "PROPOSE" | "VOTE" | "ACTIF" | "REMPLACE";
export type MethodePaiement = "CMI" | "VIREMENT" | "ESPECES" | "CHEQUE";
export type StatutAg = "PLANIFIEE" | "CONVOQUEE" | "EN_COURS" | "CLOTUREE" | "ANNULEE";
export type TypeAg = "ORDINAIRE" | "EXTRAORDINAIRE" | "REVOCATION";
export type TypeMajorite = "SIMPLE" | "DOUBLE" | "UNANIMITE";
export type ResultatResolution = "EN_ATTENTE" | "ADOPTEE" | "REJETEE";
export type ValeurVote = "POUR" | "CONTRE" | "ABSTENTION";
export type StatutIncident = "OUVERT" | "EN_COURS" | "RESOLU" | "FERME";
export type UrgenceIncident = "NORMALE" | "URGENTE" | "URGENCE_MAXIMALE";
export type PartieIncident = "COMMUNE" | "PRIVATIVE";
export type CategorieIncident =
  | "PLOMBERIE"
  | "ELECTRICITE"
  | "ASCENSEUR"
  | "NETTOYAGE"
  | "SECURITE"
  | "STRUCTURE"
  | "JARDINS_ESPACES_VERTS"
  | "NUISANCES"
  | "PARKING"
  | "EQUIPEMENTS_COLLECTIFS"
  | "ADMINISTRATIF";
export type StatutReservation = "EN_ATTENTE" | "CONFIRMEE" | "REJETEE" | "ANNULEE";
export type StatutVisite = "EN_ATTENTE" | "AUTORISE" | "REFUSE";
export type StatutPersonnel = "PRESENT" | "ABSENT" | "REMPLACE";
export type StatutLitige = "OUVERT" | "RESOLU" | "CLOS";
export type StatutInvitation = "EN_ATTENTE" | "ACCEPTEE" | "EXPIREE" | "REGENEREE";
export type CanalInvitation = "EMAIL" | "SMS" | "QR_CODE" | "WHATSAPP";
export type StatutContestation = "OUVERTE" | "REPONDUE" | "MEDIEE" | "TRIBUNAL";
export type VisibiliteDocument = "PUBLIC_COPROPRIETE" | "SYNDIC_ONLY" | "CONSEIL_SYNDICAL";
export type TypePropriete = "PLEIN" | "INDIVISION" | "SCI";
export type TypeOccupation = "PROPRIETAIRE_OCCUPANT" | "LOCATAIRE";
export type Langue = "FR" | "AR";

// ── Auth ────────────────────────────────────────────────────────────────────
export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  utilisateur_id?: string | null;
}

/** Aperçu public d'une invitation (avant inscription) — aucune donnée personnelle. */
export interface InviteApercu {
  copropriete_nom: string;
  ville: string;
  role_cible: RoleType;
  expire_le: string;
  statut: "EN_ATTENTE" | "ACCEPTEE" | "EXPIREE" | "REGENEREE" | "INVALIDE" | "OUVERTE";
  /** Vrai quand cet appareil est celui qui a ouvert le code en premier. */
  ouverte?: boolean;
}

export interface InviteInscriptionResult extends SessionTokens {
  copropriete_id: string;
  role: RoleType;
  statut_compte: StatutCompte;
}

export interface InviteAcceptResult {
  copropriete_id: string;
  lot_id: string | null;
  role: RoleType;
  statut_compte: StatutCompte;
}

// ── Utilisateurs ────────────────────────────────────────────────────────────
export interface ProfilRole {
  copropriete_id: string;
  role: RoleType;
  actif: boolean;
}

export interface Profil {
  id: string;
  email: string | null;
  telephone: string | null;
  nom: string | null;
  prenom: string | null;
  langue_preferee: Langue;
  statut_compte: StatutCompte;
  raison_sociale: string | null;
  roles?: ProfilRole[];
}

/** GET /users — annuaire syndic. */
export interface MembreCopropriete extends Omit<Profil, "roles"> {
  roles: Array<{ role: RoleType; actif: boolean; depuis: string }>;
  lots: Array<{ id: string; numero: string; lien: "PROPRIETAIRE" | "OCCUPANT" }>;
  membre_depuis: string;
}

// ── Copropriétés ────────────────────────────────────────────────────────────
export interface Copropriete {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  typeResidence: TypeResidence;
  nbLots: number;
  dateCreation: string;
  statut: "ACTIVE" | "ARCHIVEE";
  configJson: Record<string, unknown> | null;
  /** Logo de la résidence (chemin storage, servi via /api/copro-logo). */
  logoStoragePath?: string | null;
  delaiConvocationJours: number | null;
  totalTantiemes: string | null;
  politiqueRecouvrementJson: Record<string, unknown> | null;
  quorumPremiereConvocation: string | null;
  limiteProcurationsMandataire: number | null;
  retentionDesactivationMois: number | null;
  creeLe: string;
  modifieLe: string;
}

// ── Lots ────────────────────────────────────────────────────────────────────
export interface UtilisateurNom {
  id: string;
  nom: string | null;
  prenom: string | null;
}

export interface LotProprietaire {
  id: string;
  lotId: string;
  utilisateurId: string;
  quotePart: string;
  typePropriete: TypePropriete;
  estRepresentantIndivision: boolean;
  dateDebut: string;
  dateFin: string | null;
  utilisateur?: UtilisateurNom | null;
}

export interface LotOccupant {
  id: string;
  lotId: string;
  utilisateurId: string;
  typeOccupation: TypeOccupation;
  dateDebut: string;
  dateFin: string | null;
  accesFinancesAccorde: boolean;
  recoitConvocations: boolean;
  utilisateur?: UtilisateurNom | null;
}

export interface Lot {
  id: string;
  coproprieteId: string;
  typeLot: TypeLot;
  typeUsage: "HABITATION" | "BUREAU" | "MIXTE" | "COMMERCIAL" | null;
  numero: string;
  etage: number | null;
  tantiemes: string;
  superficie: string | null;
  statut: StatutLot;
  lotParentId: string | null;
  creeLe: string;
  modifieLe: string;
  proprietaires?: LotProprietaire[];
  occupants?: LotOccupant[];
}

// ── Invitations ─────────────────────────────────────────────────────────────
export interface Invitation {
  id: string;
  coproprieteId: string;
  lotId: string | null;
  roleCible: RoleType;
  emetteurId: string;
  canal: CanalInvitation;
  code: string;
  statut: StatutInvitation;
  expireLe: string;
  /** Premier scan (usage unique) — null tant que personne n'a ouvert le code. */
  ouverteLe?: string | null;
  creeLe: string;
}

// ── Finances ────────────────────────────────────────────────────────────────
export interface BudgetAg {
  id: string;
  coproprieteId: string;
  agId: string | null;
  exercice: string;
  montantTotal: string;
  statut: StatutBudget;
  creeLe: string;
  modifieLe: string;
}

export interface AppelDeFondsLigne {
  id: string;
  appelDeFondsId: string;
  lotId: string;
  montantDu: string;
  montantPaye: string;
  statut: StatutLigneAppel;
  tropPercuAutorise: boolean;
  conteste: boolean;
  niveauEscalade: NiveauEscalade;
  derniereEscaladeLe: string | null;
  creeLe: string;
  modifieLe: string;
}

export interface AppelDeFonds {
  id: string;
  coproprieteId: string;
  periode: string;
  type: TypeAppelDeFonds;
  montantTotal: string;
  dateEcheance: string;
  statut: "BROUILLON" | "EMIS" | "CLOTURE";
  creeLe: string;
  modifieLe: string;
  lignes?: AppelDeFondsLigne[];
}

export interface SoldeLot {
  lot_id: string;
  solde_du: string;
  lignes: Array<{
    appel_de_fonds_lot_id: string;
    montant_du: string;
    montant_paye: string;
    statut: StatutLigneAppel;
    conteste: boolean;
  }>;
}

export interface Paiement {
  id: string;
  lotId: string;
  appelDeFondsLotId: string;
  montant: string;
  methode: MethodePaiement;
  referenceCmi: string | null;
  statut: "VALIDE" | "EN_ATTENTE" | "REJETE";
  payeurUtilisateurId: string | null;
  horodatage: string;
}

export interface Quittance {
  id: string;
  appelDeFondsLotId: string;
  pdfUrl: string | null;
  numero: string;
  dateEmission: string;
}

/** POST /finances/paiements — mode ciblé (appel_de_fonds_lot_id). */
export interface PaiementCibleResult {
  paiement: Paiement;
  statut: StatutLigneAppel;
  quittance: Quittance | null;
}

/** POST /finances/paiements — mode FIFO (lot_id). */
export interface PaiementFifoResult {
  lot_id: string;
  montant: string;
  affectations: Array<{
    appel_de_fonds_lot_id: string;
    montant: string;
    statut: StatutLigneAppel;
  }>;
  quittance: Quittance | null;
}

export interface Contestation {
  id: string;
  appelDeFondsLotId: string;
  utilisateurId: string;
  motif: string;
  statut: StatutContestation;
  reponseSyndic: string | null;
  creeLe: string;
  modifieLe: string;
}

// ── Assemblées générales ────────────────────────────────────────────────────
export interface AgResolution {
  id: string;
  agId: string;
  ordre: number;
  texte: string;
  typeMajorite: TypeMajorite;
  resultat: ResultatResolution;
  creeLe: string;
  modifieLe: string;
}

export interface AssembleeGenerale {
  id: string;
  coproprieteId: string;
  type: TypeAg;
  dateConvocation: string | null;
  dateAg: string;
  statut: StatutAg;
  quorumRequis: string | null;
  quorumAtteint: string | null;
  motifAnnulation: string | null;
  creeLe: string;
  modifieLe: string;
  resolutions?: AgResolution[];
}

export interface AgVote {
  id: string;
  resolutionId: string;
  lotId: string;
  utilisateurId: string;
  valeur: ValeurVote;
  tantiemesRepresentes: string;
  horodatage: string;
}

export interface AgResultatLigne {
  valeur: ValeurVote;
  nb_votants: number;
  tantiemes_total: string;
}

export interface AgProcuration {
  id: string;
  agId: string;
  lotId: string;
  mandantId: string;
  mandataireId: string;
  revoqueeLe: string | null;
  creeLe: string;
}

export interface AgPv {
  id: string;
  agId: string;
  contenuJson: {
    ag_id: string;
    type: TypeAg;
    date_ag: string;
    quorum_requis: string | null;
    quorum_atteint: string | null;
    resolutions: Array<{
      id: string;
      ordre: number;
      texte: string;
      type_majorite: TypeMajorite;
      resultat: ResultatResolution;
    }>;
  };
  pdfUrl: string | null;
  hashIntegrite: string;
  horodatageGeneration: string;
}

export interface ClotureAgResult {
  ag: AssembleeGenerale;
  pv: AgPv;
}

// ── Incidents ───────────────────────────────────────────────────────────────
export interface Incident {
  id: string;
  coproprieteId: string;
  lotId: string | null;
  categorie: CategorieIncident;
  sousCategorie: string;
  description: string | null;
  partie: PartieIncident;
  urgence: UrgenceIncident;
  statut: StatutIncident;
  creePar: string;
  assigneAId: string | null;
  slaDeadline: string | null;
  /** Chemins storage des photos du signalement (lecture via GET /incidents/:id/photos). */
  photos: string[];
  creeLe: string;
  modifieLe: string;
}

/** Synthèse opérateur d'une copropriété (console super admin). */
export interface AdminSynthese {
  lots: number;
  residents_actifs: number;
  invitations_en_attente: number;
  invitations_acceptees: number;
  incidents_ouverts: number;
  sla_depasses: number;
  documents: number;
  montant_du: string;
  montant_paye: string;
  prochaine_ag: { id: string; date_ag: string; type: string; statut: string } | null;
  derniere_activite: string | null;
}

export interface IncidentPhoto {
  path: string;
  url: string;
}

export interface IncidentLog {
  id: string;
  incidentId: string;
  statutAvant: StatutIncident | null;
  statutApres: StatutIncident;
  acteurId: string | null;
  /** Acteur de l'étape (détail d'incident uniquement). */
  acteur?: { id: string; nom: string | null; prenom: string | null } | null;
  commentaire: string | null;
  horodatage: string;
}

/** Auteur d'un signalement (détail d'incident uniquement). */
export interface IncidentCreateur {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
}

export interface Prestataire {
  id: string;
  coproprieteId: string;
  nom: string;
  specialite: string;
  contact: string;
  actif: boolean;
  utilisateurId: string | null;
  creeLe: string;
}

// ── Personnel & visites ─────────────────────────────────────────────────────
export interface Personnel {
  id: string;
  utilisateurId: string;
  coproprieteId: string;
  statut: StatutPersonnel;
  logementLotId: string | null;
  creeLe: string;
}

export interface Visite {
  id: string;
  coproprieteId: string;
  gardienId: string;
  lotId: string;
  visiteurNom: string;
  statut: StatutVisite;
  horodatage: string;
}

// ── Espaces communs ─────────────────────────────────────────────────────────
export interface EspaceCommun {
  id: string;
  coproprieteId: string;
  nom: string;
  type: string;
  capacite: number | null;
  reservable: boolean;
  reglesReservationJson: Record<string, unknown> | null;
  validationAutomatique: boolean;
}

export interface Reservation {
  id: string;
  espaceId: string;
  lotId: string;
  utilisateurId: string;
  dateDebut: string;
  dateFin: string;
  statut: StatutReservation;
  nombreInvites: number | null;
  motifRejet: string | null;
  creeLe: string;
  modifieLe: string;
}

// ── Documents & notifications ───────────────────────────────────────────────
export interface DocumentCopro {
  id: string;
  coproprieteId: string;
  type: string;
  nom: string;
  visibilite: VisibiliteDocument;
  storagePath: string;
  creePar: string;
  creeLe: string;
}

export interface Notification {
  id: string;
  coproprieteId: string;
  utilisateurId: string;
  templateCode: string;
  canal: string;
  statutEnvoi: "EN_ATTENTE" | "ENVOYE" | "ECHOUE";
  contenuJson: Record<string, unknown> | null;
  /** Titre/corps rendus dans la langue du destinataire (null si template inconnu). */
  rendu: { titre: string; corps: string } | null;
  accuseReception: string | null;
  lu: boolean;
  luLe: string | null;
  horodatageEnvoi: string;
}

// ── Litiges ─────────────────────────────────────────────────────────────────
export interface Litige {
  id: string;
  coproprieteId: string;
  type: string;
  description: string;
  statut: StatutLitige;
  escaladeNiveau: 0 | 1 | 2;
  creePar: string;
  creeLe: string;
  modifieLe: string;
}

// ── Export CNDP ─────────────────────────────────────────────────────────────
export interface ExportCndp {
  profil: Profil;
  genere_le: string;
  coproprietes: Array<{
    copropriete_id: string;
    role: RoleType;
    lots_proprietaire: unknown[];
    lots_occupant: unknown[];
    paiements: unknown[];
    votes: unknown[];
    notifications: unknown[];
  }>;
}
