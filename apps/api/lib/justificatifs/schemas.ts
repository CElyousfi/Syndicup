/**
 * Schémas Zod — M17 Justificatifs de paiement (Doc A §3.3/§3.4). Montants en chaînes décimales,
 * méthodes hors CMI, preuve = chemin storage dans le périmètre `<copropriete>/justificatifs/`.
 */
import { z } from "zod";
import { regexCheminModule } from "../documents/attach";

export const METHODES_JUSTIFICATIF = ["VIREMENT", "CHEQUE", "ESPECES"] as const;
export const STATUTS_JUSTIFICATIF = ["EN_ATTENTE", "VALIDE", "REJETE", "ANNULE"] as const;

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "1250.50").').refine((v) => Number(v) > 0, "Le montant doit être strictement positif.");

export const preuveJustificatifSchema = z.object({
  storage_path: z.string().regex(regexCheminModule("justificatifs"), "Chemin de fichier invalide."),
  nom: z.string().min(1).max(200),
});
export type PreuveJustificatifInput = z.infer<typeof preuveJustificatifSchema>;

export const justificatifUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type JustificatifUploadUrlInput = z.infer<typeof justificatifUploadUrlSchema>;

/**
 * Déclaration « j'ai payé ». `lot_id` : le résident déclare pour un de SES lots ; le syndic / gardien
 * déclarent au nom d'un lot (`pour_lot_id` — même champ, nom explicite côté contrat). `appel_de_fonds_lot_id`
 * absent = paiement sur solde (FIFO à la validation).
 */
export const justificatifCreateSchema = z.object({
  lot_id: uuid.optional(),
  pour_lot_id: uuid.optional(),
  appel_de_fonds_lot_id: uuid.nullish(),
  montant,
  methode: z.enum(METHODES_JUSTIFICATIF),
  date_paiement: dateIso,
  banque_emettrice: z.string().min(1).max(120).nullish(),
  beneficiaire: z.string().min(1).max(200),
  reference: z.string().min(1).max(120).nullish(),
  preuve: preuveJustificatifSchema.nullish(),
}).refine((v) => Boolean(v.lot_id || v.pour_lot_id), "lot_id (ou pour_lot_id) requis.");
export type JustificatifCreateInput = z.infer<typeof justificatifCreateSchema>;

export const justificatifRejeterSchema = z.object({ motif: z.string().min(1).max(1000) });
export type JustificatifRejeterInput = z.infer<typeof justificatifRejeterSchema>;

export const justificatifValiderSchema = z.object({
  // Le syndic peut corriger la date de valeur lue sur le relevé ; défaut = date déclarée.
  date_valeur: dateIso.nullish(),
});
export type JustificatifValiderInput = z.infer<typeof justificatifValiderSchema>;

export const justificatifsFiltresSchema = z.object({
  statut: z.enum(STATUTS_JUSTIFICATIF).optional(),
  lot_id: uuid.optional(),
  methode: z.enum(METHODES_JUSTIFICATIF).optional(),
});
export type JustificatifsFiltres = z.infer<typeof justificatifsFiltresSchema>;

/** Espèces reçues à la loge (gardien → justificatif EN_ATTENTE) ou au bureau (syndic → paiement VALIDE). */
export const paiementEspecesSchema = z.object({
  lot_id: uuid,
  appel_de_fonds_lot_id: uuid.nullish(),
  montant,
  date_paiement: dateIso.optional(),
  payeur_utilisateur_id: uuid.nullish(),
  preuve: preuveJustificatifSchema.nullish(),
  commentaire: z.string().min(1).max(500).nullish(),
});
export type PaiementEspecesInput = z.infer<typeof paiementEspecesSchema>;

// ── Comptes bancaires de la copropriété ─────────────────────────────────────
export const compteBancaireSchema = z.object({
  libelle: z.string().min(1).max(120),
  banque: z.string().min(1).max(120),
  rib: z.string().regex(/^[0-9]{24}$/, "RIB : 24 chiffres."),
});
export const comptesBancairesUpdateSchema = z.object({ comptes: z.array(compteBancaireSchema).max(10) });
export type ComptesBancairesUpdateInput = z.infer<typeof comptesBancairesUpdateSchema>;
