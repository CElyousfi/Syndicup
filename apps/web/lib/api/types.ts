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
  | "PERSONNE_MORALE_REPRESENTANT"
  | "GESTIONNAIRE_LCD";

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
export type RegimeLcd = "NON_DEFINI" | "AUTORISEE" | "ENCADREE" | "INTERDITE";
export type StatutDeclarationLcd = "EN_ATTENTE" | "VALIDEE" | "REFUSEE" | "SUSPENDUE" | "CLOTUREE";
export type StatutSejour = "PREVU" | "EN_COURS" | "TERMINE" | "ANNULE";
export type TypePieceIdentite = "CIN" | "PASSEPORT" | "TITRE_SEJOUR" | "AUTRE";
export type TypeEvenementSejour =
  | "DECLARE"
  | "MODIFIE"
  | "ARRIVEE_CONFIRMEE"
  | "DEPART_CONFIRME"
  | "ANNULE"
  | "INCIDENT_LIE"
  | "GARDIEN_NOTIFIE";

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
  /** Photos personnalisées de la résidence (M20) : `{ cle: chemin storage }`, servies via /api/copro-photo. */
  photosJson?: Record<string, string> | null;
  delaiConvocationJours: number | null;
  totalTantiemes: string | null;
  politiqueRecouvrementJson: Record<string, unknown> | null;
  quorumPremiereConvocation: string | null;
  limiteProcurationsMandataire: number | null;
  retentionDesactivationMois: number | null;
  creeLe: string;
  modifieLe: string;
  /** M18 — factures des dépenses PAYEE visibles par les résidents (option syndic). */
  facturesVisiblesResidents?: boolean;
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
  /** M17 — paiements déclarés en attente de validation (jamais déduits du solde dû). */
  justificatifs_en_attente?: string;
  nb_justificatifs_en_attente?: number;
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
  /** M15 — séjour de location courte durée lié (nuisance pendant un séjour). */
  sejourId: string | null;
  // M16 — évaluation du prestataire (créateur du ticket ou syndic, après RESOLU/FERME).
  notePrestataire?: number | null;
  commentairePrestataire?: string | null;
  evalueLe?: string | null;
  /** M16 — détail uniquement, rôles syndic/conseil : dépenses nées de l'incident. */
  depenses?: Depense[];
  total_depenses?: string | null;
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
  // M16 — fiche fournisseur. Le RIB complet n'est jamais dans une réponse de liste/fiche.
  ice: string | null;
  rc: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
  ribMasque: string | null;
  ribRenseigne: boolean;
  noteMoyenne: string | null;
}

// ── M16 — Dépenses, factures, postes budgétaires ────────────────────────────
export type CategorieDepense =
  | "ENTRETIEN_COURANT"
  | "REPARATIONS"
  | "TRAVAUX"
  | "PERSONNEL"
  | "ENERGIE_EAU"
  | "ASSURANCE"
  | "HONORAIRES_SYNDIC"
  | "ADMINISTRATIF"
  | "IMPOTS_TAXES"
  | "AUTRE";
export type StatutDepense = "BROUILLON" | "A_APPROUVER" | "APPROUVEE" | "REJETEE" | "PAYEE" | "ANNULEE";
export type SourceFinancement = "COMPTE_COURANT" | "FONDS_RESERVE";
export type StatutFacture = "RECUE" | "VERIFIEE" | "CONTESTEE" | "REGLEE";
export type MethodePaiementDepense = "VIREMENT" | "CHEQUE" | "ESPECES";
export type TypeDepenseLog = "CREEE" | "SOUMISE" | "APPROUVEE" | "REJETEE" | "PAYEE" | "ANNULEE" | "FACTURE_AJOUTEE" | "FACTURE_CONTESTEE" | "MODIFIEE";

export interface BudgetPoste {
  id: string;
  budgetAgId: string;
  categorie: CategorieDepense;
  libelle: string;
  montantPrevu: string;
  ordre: number;
}

export interface Facture {
  id: string;
  depenseId: string;
  prestataireId: string | null;
  numero: string | null;
  dateFacture: string;
  dateEcheance: string | null;
  montantTtc: string;
  statut: StatutFacture;
  documentId: string;
  creeLe: string;
  document?: { id: string; nom: string; type: string };
  prestataire?: { id: string; nom: string } | null;
}

export interface DepenseLog {
  id: string;
  type: TypeDepenseLog;
  acteurId: string | null;
  acteur?: { id: string; nom: string | null; prenom: string | null } | null;
  detailsJson: Record<string, unknown> | null;
  horodatage: string;
}

export interface Depense {
  id: string;
  coproprieteId: string;
  budgetAgId: string | null;
  budgetPosteId: string | null;
  prestataireId: string | null;
  categorie: CategorieDepense;
  libelle: string;
  description: string | null;
  montantHt: string | null;
  tva: string | null;
  montantTtc: string;
  dateDepense: string;
  statut: StatutDepense;
  source: SourceFinancement;
  incidentId: string | null;
  contratId: string | null;
  personnelId: string | null;
  periodePaie: string | null;
  creeParId: string;
  approuveParId: string | null;
  approuveLe: string | null;
  motifRejet: string | null;
  payeLe: string | null;
  methodePaiement: MethodePaiementDepense | null;
  referencePaiement: string | null;
  justificatifPaiementDocumentId: string | null;
  resolutionAgId: string | null;
  creeLe: string;
  modifieLe: string;
  prestataire?: { id: string; nom: string; specialite: string } | null;
  budgetPoste?: { id: string; libelle: string; categorie: CategorieDepense } | null;
  incident?: { id: string; categorie: string; sousCategorie: string; statut: string } | null;
  resolutionAg?: { id: string; texte: string; resultat: string; agId: string } | null;
  creePar?: { id: string; nom: string | null; prenom: string | null } | null;
  approuvePar?: { id: string; nom: string | null; prenom: string | null } | null;
  _count?: { factures: number };
}

export interface DepenseDetail extends Depense {
  factures: Facture[];
  logs: DepenseLog[];
  justificatifPaiementDocument: { id: string; nom: string; type: string } | null;
  mouvementsFondsReserve: Array<{ id: string; montant: string; horodatage: string; resolutionAgId: string | null }>;
  niveau_approbation_requis: "SYNDIC" | "CONSEIL";
  seuil_non_configure: boolean;
}

export interface DepensesTotaux {
  montant_ttc: string;
  par_statut: Partial<Record<StatutDepense, { nb: number; montant_ttc: string }>>;
}

export interface DepenseDocuments {
  factures: Array<{ facture_id: string; document_id: string; numero: string | null; statut: StatutFacture; nom: string; type: string; url: string }>;
  justificatif_paiement: { document_id: string; nom: string; type: string; url: string } | null;
}

export interface BudgetVsRealiseLigne {
  poste_id?: string;
  categorie: CategorieDepense;
  libelle?: string;
  ordre?: number;
  montant_prevu: string | null;
  en_attente: string;
  engage: string;
  realise: string;
  consomme: string;
  ecart: string | null;
  pourcentage_realise: string | null;
  pourcentage_consomme: string | null;
  depassement: boolean;
  nb_depenses: number;
}

export interface BudgetVsRealise {
  exercice: string;
  budget: { id: string; statut: StatutBudget; montant_total: string } | null;
  postes: BudgetVsRealiseLigne[];
  hors_poste: BudgetVsRealiseLigne[];
  par_categorie: BudgetVsRealiseLigne[];
  totaux: BudgetVsRealiseLigne;
  fonds_reserve: { solde: string; decaisse_exercice: string; engage: string };
  impayes_total: string;
  seuil_approbation_conseil: string | null;
  seuil_non_configure: boolean;
  nb_a_approuver: number;
}

// ── M17 — Justificatifs de paiement ─────────────────────────────────────────
export type StatutJustificatif = "EN_ATTENTE" | "VALIDE" | "REJETE" | "ANNULE";
export interface Justificatif {
  id: string;
  coproprieteId: string;
  lotId: string;
  appelDeFondsLotId: string | null;
  declareParId: string;
  montant: string;
  methode: "VIREMENT" | "CHEQUE" | "ESPECES";
  datePaiementDeclaree: string;
  banqueEmettrice: string | null;
  beneficiaire: string;
  reference: string | null;
  documentId: string | null;
  statut: StatutJustificatif;
  traiteParId: string | null;
  traiteLe: string | null;
  motifRejet: string | null;
  paiementId: string | null;
  detailsJson: { affectations?: Array<{ appel_de_fonds_lot_id: string; montant: string; statut: string }>; date_valeur?: string; quittance_id?: string | null } | null;
  creeLe: string;
  lot?: { id: string; numero: string; typeLot: string };
  declarePar?: { id: string; nom: string | null; prenom: string | null } | null;
  traitePar?: { id: string; nom: string | null; prenom: string | null } | null;
  document?: { id: string; nom: string } | null;
}
export interface JustificatifDetail extends Justificatif {
  preuve: { nom: string; url: string } | null;
  lignes_ouvertes: Array<{ appel_de_fonds_lot_id: string; periode: string; type: string; date_echeance: string; montant_du: string; montant_paye: string; restant: string; statut: string }>;
  paiements: Array<{ id: string; montant: string; appelDeFondsLotId: string; horodatage: string }>;
}
export interface CompteBancaire {
  index: number;
  libelle: string;
  banque: string;
  rib_masque: string;
}

export interface PrestataireFiche extends Prestataire {
  nb_interventions: number;
  interventions: Array<{ id: string; categorie: CategorieIncident; sousCategorie: string; statut: StatutIncident; urgence: UrgenceIncident; creeLe: string }>;
  evaluations: Array<{ incident_id: string; note: number | null; commentaire: string | null; evalue_le: string | null }>;
  depenses: { total_paye: string; total_engage: string; nb: number; recentes: Depense[] } | null;
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

// ── M15 — Location courte durée ─────────────────────────────────────────────
/** Paramètres du régime ENCADREE — `null` = non configuré (jamais deviné, LEGAL_QUESTIONS_BRIEF §7). */
export interface LcdParametres {
  declaration_prealable_obligatoire: boolean;
  delai_declaration_heures: number | null;
  nb_nuits_max_par_an: number | null;
  nb_voyageurs_max_par_lot: number | null;
  gestionnaire_obligatoire_si_proprietaire_absent: boolean;
  contact_gardien_obligatoire: boolean;
}

export interface LcdReglement {
  regimeLcd: RegimeLcd;
  parametresLcdJson: LcdParametres | null;
  regimeLcdAgResolutionId: string | null;
  agResolution: { id: string; texte: string; resultat: ResultatResolution; agId: string } | null;
}

export interface LcdLotRef {
  id: string;
  numero: string;
  typeLot: TypeLot;
}

export interface LcdDeclaration {
  id: string;
  coproprieteId: string;
  lotId: string;
  lot: LcdLotRef;
  declareParId: string;
  gestionnaireId: string | null;
  plateformesJson: string[] | null;
  contactUrgenceNom: string | null;
  contactUrgenceTelephone: string | null;
  statut: StatutDeclarationLcd;
  motifDecision: string | null;
  decideParId: string | null;
  decideLe: string | null;
  dateDebut: string;
  dateFin: string | null;
  creeLe: string;
  modifieLe: string;
}

export interface LcdPieceJointe {
  path: string;
  url: string;
  nom: string;
  type: "IMAGE" | "PDF";
}

export interface LcdSejour {
  /** Chemins storage des pièces jointes (lecture via /lcd/sejours/{id}/pieces-jointes). */
  piecesJointes: string[];
  id: string;
  coproprieteId: string;
  lotId: string;
  lot: LcdLotRef;
  declarationLcdId: string;
  declareParId: string;
  /** Date (minuit UTC). */
  dateArrivee: string;
  dateDepart: string;
  heureArriveePrevue: string | null;
  nbVoyageurs: number;
  voyageurPrincipalNom: string;
  voyageurTelephone: string | null;
  voyageurNationalite: string | null;
  pieceIdentiteType: TypePieceIdentite | null;
  /** 4 derniers caractères au plus — jamais le numéro complet (CNDP). */
  pieceIdentiteFin: string | null;
  plaqueVehicule: string | null;
  statut: StatutSejour;
  annuleLe: string | null;
  motifAnnulation: string | null;
  gardienInformeLe: string | null;
  creeLe: string;
  modifieLe: string;
}

export interface LcdSejourEvenement {
  id: string;
  sejourId: string;
  type: TypeEvenementSejour;
  acteurId: string | null;
  detailsJson: Record<string, unknown> | null;
  horodatage: string;
}

export interface LcdSynthese {
  lot: { id: string; numero: string };
  regimeLcd: RegimeLcd;
  declaration: LcdDeclaration | null;
  annee: number;
  nuitsUtilisees: number;
  nuitsQuota: number | null;
  derniersSejours: LcdSejour[];
  incidentsLies: number;
}

export interface LcdDuJour {
  date: string;
  arrivees: LcdSejour[];
  departs: LcdSejour[];
  enCours: LcdSejour[];
}

/** POST /lcd/declarations/{id}/gestionnaire — invitation générée quand la personne n'a pas de compte. */
export interface LcdGestionnaireResult {
  declaration: LcdDeclaration;
  invitation: { id: string; code: string; expireLe: string; canal: CanalInvitation } | null;
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

// ── M18 — Rapports, rapport de gestion, exports, transparence ────────────────
export type StatutRapportGestion = "BROUILLON" | "GENERE" | "SOUMIS_AG" | "APPROUVE" | "REJETE";
export type TrancheAnciennete = "0_30" | "31_90" | "91_180" | "PLUS_180";

export interface Recouvrement {
  appele: string;
  encaisse: string;
  reste: string;
  taux: string | null;
  nb_lignes: number;
}
export interface TrancheImpayes {
  tranche: TrancheAnciennete;
  montant: string;
  nb_lignes: number;
  nb_lots: number;
}
export interface DepensesParCategorie {
  total: string;
  nb: number;
  categories: { categorie: CategorieDepense; montant: string; nb: number; part: string | null }[];
}
export interface TableauDeBord {
  exercice: string;
  genere_le: string;
  tresorerie: {
    compte_courant_estime: string;
    total_entrees: string;
    total_sorties_compte_courant: string;
    reserve: string;
    reserve_configuree: boolean;
    serie_12_mois: { mois: string; entrees: string; sorties: string; solde: string }[];
  };
  recouvrement: { exercice: Recouvrement; periode: Recouvrement & { mois: string } };
  impayes: {
    total: string;
    nb_lots_en_retard: number;
    nb_lignes: number;
    tranches: TrancheImpayes[];
    top_lots: { lot_id: string; lot_numero: string; reste_du: string; nb_lignes: number; retard_max_jours: number; conteste: boolean }[];
  };
  depenses: { exercice: DepensesParCategorie; mois: DepensesParCategorie & { mois: string } };
  budget_vs_realise: BudgetVsRealise;
  incidents_ouverts: { total: number; par_urgence: Record<UrgenceIncident, number> };
  justificatifs_en_attente: { nb: number; montant: string };
  contrats: IndicateursContrats;
}
export interface TransparenceDepense {
  id: string;
  libelle: string;
  categorie: CategorieDepense;
  montant_ttc: string;
  source: string;
  date: string;
  prestataire: string | null;
  poste: string | null;
  factures?: { id: string; numero: string | null; montant_ttc: string; url: string }[];
}
export interface Transparence {
  exercice: string;
  copropriete: string | null;
  factures_visibles: boolean;
  tresorerie: { compte_courant_estime: string; reserve: string; reserve_configuree: boolean };
  recouvrement: { exercice: string | null; appele: string; encaisse: string };
  impayes: { total: string; nb_lots_en_retard: number };
  budget_vs_realise: {
    budget: { id: string; statut: string; montant_total: string } | null;
    postes: { poste_id: string; libelle: string; categorie: CategorieDepense; montant_prevu: string | null; realise: string; pourcentage_realise: string | null; depassement: boolean }[];
    totaux: { montant_prevu: string | null; realise: string; pourcentage_realise: string | null };
    fonds_reserve: { solde: string; decaisse_exercice: string; engage: string };
  };
  depenses_par_categorie: DepensesParCategorie;
  depenses: TransparenceDepense[];
  rapports_gestion: { document_id: string; nom: string; date: string }[];
}
export interface LigneGrandLivre {
  date: string;
  type: "ENTREE" | "SORTIE" | "RESERVE";
  compte: "COMPTE_COURANT" | "FONDS_RESERVE";
  libelle: string;
  reference: string | null;
  tiers: string | null;
  categorie: string | null;
  entree: string | null;
  sortie: string | null;
  solde_compte_courant: string;
  solde_reserve: string;
  entite: "paiement" | "depense" | "fonds_reserve_mouvement";
  entite_id: string;
}
export interface GrandLivre {
  exercice: string;
  ouverture: { compte_courant: string; reserve: string };
  totaux: { entrees: string; sorties_compte_courant: string; sorties_reserve: string; mouvements_reserve: string };
  cloture: { compte_courant: string; reserve: string };
  nb_lignes: number;
  lignes: LigneGrandLivre[];
}
export interface RapportGestionResume {
  compte_courant_cloture: string;
  reserve_cloture: string;
  taux_recouvrement: string | null;
  impayes_total: string;
  nb_lots_en_retard: number;
  depenses_total: string;
  budget_prevu: string | null;
  budget_realise: string;
}
export interface RapportGestionDonnees {
  version: 1;
  exercice: string;
  genere_le: string;
  copropriete: { id: string; nom: string; adresse: string; ville: string; nb_lots: number; logo_storage_path: string | null };
  syndic: { id: string; nom: string | null };
  president_conseil: { id: string | null; nom: string | null };
  budget_ag_id: string | null;
  tresorerie: {
    reserve_configuree: boolean;
    ouverture: { compte_courant: string; reserve: string };
    totaux: { entrees: string; sorties_compte_courant: string; sorties_reserve: string; mouvements_reserve: string };
    cloture: { compte_courant: string; reserve: string };
  };
  grand_livre_nb_lignes: number;
  recouvrement: Recouvrement;
  impayes: { total: string; nb_lots_en_retard: number; nb_lignes: number; tranches: TrancheImpayes[]; par_lot: { lot_id: string; lot_numero: string; reste_du: string; nb_lignes: number; retard_max_jours: number; conteste: boolean }[]; arrete_le: string };
  budget_vs_realise: BudgetVsRealise;
  depenses_par_categorie: DepensesParCategorie;
  depenses: TransparenceDepense[];
  reserve: { solde_ouverture: string; solde_cloture: string; mouvements: { id: string; date: string; type: string; montant: string; description: string | null; depense_id: string | null }[] };
  faits_marquants: {
    nb_incidents: number;
    incidents_majeurs: { id: string; categorie: string; sous_categorie: string; statut: string; date: string }[];
    ag_tenues: { id: string; type: string; date: string; quorum_atteint: string | null; nb_resolutions: number }[];
    contrats_signes: { id: string; libelle: string; type: string; date: string }[];
  };
  justificatifs_en_attente: { nb: number; montant: string };
  seuil_approbation_non_configure: boolean;
}
export interface RapportGestion {
  id: string;
  exercice: string;
  statut: StatutRapportGestion;
  budget_ag_id: string | null;
  ag: { id: string; type: TypeAg; date_ag: string; statut: StatutAg } | null;
  resolution: { id: string; ordre: number; texte: string; type_majorite: TypeMajorite; resultat: ResultatResolution } | null;
  document_id: string | null;
  document_visibilite: VisibiliteDocument | null;
  document_url?: string | null;
  genere_par: { id: string; nom: string | null; prenom: string | null } | null;
  genere_le: string;
  cree_le: string;
  modifie_le: string;
  resume: RapportGestionResume;
  donnees?: RapportGestionDonnees;
  regenere?: boolean;
  pdf_erreur?: string | null;
}
export interface LigneImpayee {
  appel_de_fonds_lot_id: string;
  lot_id: string;
  lot_numero: string;
  periode: string;
  type: TypeAppelDeFonds;
  date_echeance: string;
  montant_du: string;
  montant_paye: string;
  reste_du: string;
  retard_jours: number;
  tranche: TrancheAnciennete;
  statut: StatutLigneAppel;
  conteste: boolean;
  niveau_escalade: string;
}
export interface SyntheseImpayes {
  total: string;
  nb_lots_en_retard: number;
  nb_lignes: number;
  tranches: TrancheImpayes[];
}
export interface ExportLog {
  id: string;
  type: string;
  filtres: Record<string, unknown> | null;
  nb_lignes: number;
  horodatage: string;
  utilisateur: { id: string; nom: string | null; prenom: string | null } | null;
}
export interface ReleveLot {
  exercice: string;
  emis_le: string;
  copropriete: { nom: string; adresse: string; ville: string };
  lot: { id: string; numero: string; type_lot: TypeLot; etage: number | null; tantiemes: string };
  proprietaires: { nom: string | null; prenom: string | null; quote_part: string; type_propriete: string }[];
  appels: { appel_de_fonds_lot_id: string; periode: string; type: TypeAppelDeFonds; date_echeance: string; montant_du: string; montant_paye: string; reste_du: string; statut: StatutLigneAppel; conteste: boolean }[];
  paiements: { id: string; date: string; methode: string; montant: string; reference: string | null; periode: string }[];
  justificatifs_en_attente: { id: string; date_paiement: string; methode: string; montant: string; reference: string | null }[];
  totaux: { appele: string; paye: string; solde_exercice: string; solde_total_du: string; en_attente: string };
}

// ── M19 — Contrats, assurances, échéances ────────────────────────────────────
export type TypeContrat = "ASSURANCE_IMMEUBLE" | "ASSURANCE_RC" | "ASCENSEUR" | "NETTOYAGE" | "GARDIENNAGE" | "JARDINAGE" | "DERATISATION" | "EAU" | "ELECTRICITE" | "INTERNET" | "SYNDIC_PROFESSIONNEL" | "TRAVAUX" | "AUTRE";
export type StatutContrat = "BROUILLON" | "ACTIF" | "SUSPENDU" | "RESILIE" | "EXPIRE";
export type Periodicite = "MENSUELLE" | "TRIMESTRIELLE" | "SEMESTRIELLE" | "ANNUELLE" | "PONCTUELLE";
export type TypeEcheance = "PAIEMENT" | "RENOUVELLEMENT" | "VISITE_TECHNIQUE" | "CONTROLE_REGLEMENTAIRE" | "AUTRE";
export type StatutEcheanceContrat = "A_VENIR" | "DEPENSE_GENEREE" | "REALISEE" | "MANQUEE" | "ANNULEE";

export interface DetailsAssurance {
  assureur: string;
  numero_police: string;
  garanties: string[];
  franchise?: string | null;
  capital_assure?: string | null;
}
export interface ContratEcheance {
  id: string;
  contratId: string;
  type: TypeEcheance;
  dateEcheance: string;
  montant: string | null;
  statut: StatutEcheanceContrat;
  depenseId: string | null;
  depense: { id: string; libelle: string; statut: StatutDepense; montantTtc: string } | null;
  tacheId: string | null;
  notifieJ30Le: string | null;
  notifieJ7Le: string | null;
  contrat?: { id: string; libelle: string; type: TypeContrat; statut: StatutContrat; prestataire: { nom: string } | null };
}
export interface Contrat {
  id: string;
  coproprieteId: string;
  prestataireId: string | null;
  prestataire: { id: string; nom: string; specialite: string; telephone: string | null; email: string | null } | null;
  type: TypeContrat;
  libelle: string;
  reference: string | null;
  dateDebut: string;
  dateFin: string | null;
  tacite: boolean;
  preavisJours: number | null;
  periodicite: Periodicite;
  montantPeriode: string | null;
  budgetPosteId: string | null;
  budgetPoste: { id: string; libelle: string; categorie: CategorieDepense } | null;
  statut: StatutContrat;
  document: { id: string; nom: string; type: string } | null;
  attestationDocument: { id: string; nom: string; type: string } | null;
  detailsAssuranceJson: DetailsAssurance | null;
  resolutionAgId: string | null;
  resolutionAg: { id: string; texte: string; resultat: ResultatResolution; agId: string } | null;
  notes: string | null;
  motifResiliation: string | null;
  dateResiliation: string | null;
  creePar: { id: string; nom: string | null; prenom: string | null } | null;
  creeLe: string;
  modifieLe: string;
  jours_avant_fin: number | null;
  a_renouveler: boolean;
  est_assurance: boolean;
  _count: { echeances: number; depenses: number };
}
export interface ContratDetail extends Contrat {
  documents: { document_id: string; nom: string; type: string; url: string }[];
  echeances: ContratEcheance[];
  depenses: { id: string; libelle: string; statut: StatutDepense; montantTtc: string; dateDepense: string }[];
  logs: { id: string; type: string; horodatage: string; acteur: { id: string; nom: string | null; prenom: string | null } | null; details: Record<string, unknown> | null }[];
}
export interface EtatAssurance {
  immeuble_active: boolean;
  rc_active: boolean;
  polices: { id: string; type: TypeContrat; libelle: string; date_fin: string | null; echue: boolean; attestation: boolean; assureur: string | null }[];
}
export interface Echeancier {
  from: string;
  to: string;
  total_montant: string;
  echeances: ContratEcheance[];
}
export interface IndicateursContrats {
  actifs: number;
  a_echoir_30j: number;
  echus_90j: number;
  echeances_30j: { nb: number; montant: string };
  echeances_manquees: number;
  assurance_immeuble_active: boolean;
  assurance_rc_active: boolean;
}
