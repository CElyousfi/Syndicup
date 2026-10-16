/** Types des réponses de la console opérateur (M29 — packages/api-contract/openapi.yaml, tag Abonnements). */

export type NiveauAcces = "OK" | "RAPPEL" | "GRACE" | "BLOQUE";
export type EtatAbonnement =
  | "SANS_ABONNEMENT" | "EN_ESSAI" | "A_JOUR" | "RENOUVELLEMENT_PROCHE" | "ESSAI_EXPIRE"
  | "EN_RETARD" | "ACCES_PROLONGE" | "BLOQUE_IMPAYE" | "SUSPENDU" | "RESILIE";
export type StatutAbonnement = "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";
export type Formule = "ESSENTIEL" | "STANDARD" | "PRESTIGE" | "CABINET";
export type Periodicite = "ANNUELLE" | "MENSUELLE";
export type StatutFacture = "EMISE" | "PAYEE" | "ANNULEE";
export type ModePaiement = "VIREMENT" | "CHEQUE" | "ESPECES" | "CARTE" | "AUTRE";
export type TypeClient = "SYNDICAT" | "CABINET";
export type TypeEvenement =
  | "CREE" | "MODIFIE" | "ESSAI_PROLONGE" | "DELAI_ACCORDE" | "FACTURE_EMISE" | "FACTURE_ANNULEE"
  | "PAIEMENT_ENREGISTRE" | "ACTIVE" | "SUSPENDU" | "REACTIVE" | "RESILIE"
  | "COPROPRIETE_RATTACHEE" | "COPROPRIETE_RETIREE" | "RAPPEL_ENVOYE" | "LOTS_DEPASSES";

export interface EtatAcces {
  etat: EtatAbonnement;
  niveau: NiveauAcces;
  echeance: string | null;
  jours_avant_echeance: number | null;
  date_blocage: string | null;
  jours_avant_blocage: number | null;
}

export interface AbonnementResidence {
  niveau: NiveauAcces;
  etat: EtatAbonnement;
  gestionnaire: boolean;
  date_blocage: string | null;
  jours_avant_blocage: number | null;
  echeance: string | null;
  jours_avant_echeance: number | null;
  abonnement: { statut: StatutAbonnement; formule: Formule; periodicite: Periodicite } | null;
  contact: { email: string | null; whatsapp: string | null };
}

export interface ClientFacturation {
  id: string;
  type: TypeClient;
  nom: string;
  raison_sociale: string | null;
  ice: string | null;
  rc: string | null;
  identifiant_fiscal: string | null;
  adresse: string | null;
  ville: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  contact_telephone: string | null;
  cabinet_id: string | null;
  notes: string | null;
  cree_le: string;
  abonnements?: number;
}

export interface Abonnement {
  id: string;
  client: { id: string; nom: string; type: TypeClient; contact_email: string | null; contact_telephone: string | null };
  formule: Formule;
  periodicite: Periodicite;
  statut: StatutAbonnement;
  base_prix: "TTC" | "HT";
  prix_lot: string;
  taux_tva: string;
  minimum_mensuel: string | null;
  forfait_accompagne: string | null;
  lots_contractes: number;
  lots_reels: number;
  depassement_lots: boolean;
  tarif_fondateur: boolean;
  prix_garanti_jusqu_au: string | null;
  date_debut: string;
  fin_essai: string | null;
  fin_periode: string | null;
  delai_grace_jours: number;
  acces_prolonge_jusqu_au: string | null;
  motif_prolongation: string | null;
  suspendu_le: string | null;
  motif_suspension: string | null;
  resilie_le: string | null;
  motif_resiliation: string | null;
  notes: string | null;
  mensuel_ht: string;
  etat: EtatAcces;
  coproprietes: { id: string; nom: string; ville: string; nb_lots_declares: number; lots_reels: number }[];
  cree_le: string;
  factures_ouvertes?: number;
  du_ttc?: string;
}

export interface FactureCourte {
  id: string;
  numero: string;
  abonnement_id: string;
  client_id: string;
  periode_debut: string;
  periode_fin: string;
  lots: number;
  montant_ht: string;
  montant_tva: string;
  montant_ttc: string;
  statut: StatutFacture;
  emise_le: string;
  echeance: string;
  payee_le: string | null;
  annulee_le: string | null;
  motif_annulation: string | null;
  en_retard: boolean;
  client_nom?: string;
  paye?: string;
}

export interface Paiement {
  id: string;
  montant: string;
  mode: ModePaiement;
  reference: string | null;
  recu_le: string;
  cree_le: string;
}

export interface EvenementAbonnement {
  id: string;
  type: TypeEvenement;
  details: Record<string, unknown> | null;
  acteur: string | null;
  horodatage: string;
  client?: string;
  abonnement_id?: string;
}

export interface AbonnementDetail extends Abonnement {
  client_fiche: ClientFacturation;
  prochaine_periode: { debut: string; fin: string; mois: number };
  factures: (FactureCourte & { paiements: Paiement[]; paye: string })[];
  evenements: EvenementAbonnement[];
}

export interface FactureDetail extends FactureCourte {
  lignes: { base_prix: "TTC" | "HT"; lignes: { libelle: string; quantite: string; prix_unitaire: string; montant: string }[]; coproprietes?: string[] };
  client: ClientFacturation;
  abonnement: { formule: Formule; periodicite: Periodicite; base_prix: "TTC" | "HT"; taux_tva: string };
  paiements: Paiement[];
  paye: string;
  reste_du: string;
}

export type TypeATraiter = "BLOQUE" | "GRACE" | "FIN_ESSAI" | "RENOUVELLEMENT" | "DEPASSEMENT_LOTS";

export interface VueEnsemble {
  calcule_le: string;
  mrr_ht: string;
  arr_ht: string;
  pipeline_essais_mensuel_ht: string;
  encaisse_30j: string;
  abonnements_actifs: number;
  essais_en_cours: number;
  lots_factures: number;
  par_etat: Partial<Record<EtatAbonnement, number>>;
  factures_ouvertes: { nombre: number; montant_ttc: string };
  factures_en_retard: FactureCourte[];
  coproprietes: { total: number; couvertes: number; sans_abonnement: { id: string; nom: string; ville: string; nb_lots: number; creee_le: string }[] };
  a_traiter: { type: TypeATraiter; abonnement_id: string; client: string; coproprietes: string[]; etat: EtatAcces; lots_contractes: number; lots_reels: number }[];
  activite_recente: EvenementAbonnement[];
}

export interface ResidenceAdmin {
  id: string;
  nom: string;
  ville: string;
  type_residence: string;
  statut: "ACTIVE" | "ARCHIVEE";
  nb_lots_declares: number;
  lots_reels: number;
  comptes_actifs: number;
  cabinet: { id: string; nom: string } | null;
  creee_le: string;
  abonnement: { id: string; client: string; formule: Formule; statut: StatutAbonnement; etat: EtatAcces } | null;
}

export interface UtilisateurAdmin {
  id: string;
  email: string | null;
  telephone: string | null;
  nom: string | null;
  prenom: string | null;
  statut_compte: string;
  cree_le: string;
  roles: { role: string; copropriete_id: string; copropriete_nom: string }[];
}

export interface TarifSuggere {
  formule: Formule;
  base_prix: "TTC" | "HT";
  prix_lot: string;
  prix_catalogue: string;
  minimum_mensuel: string;
  taux_tva: string;
  tarif_fondateur: boolean;
  periodicite: Periodicite;
  mensuel_estime: string;
  annuel_estime: string;
  forfait_accompagne_suggere: string;
  repere_charges: string | null;
}
