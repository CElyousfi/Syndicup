/**
 * Schémas Zod — M19 Contrats, assurances, échéances (Doc A §7, §8). Montants en chaînes décimales,
 * enums fermés, dates « YYYY-MM-DD », documents dans le périmètre `<copropriete>/contrats/`.
 */
import { z } from "zod";
import { regexCheminModule } from "../documents/attach";

export const TYPES_CONTRAT = ["ASSURANCE_IMMEUBLE", "ASSURANCE_RC", "ASCENSEUR", "NETTOYAGE", "GARDIENNAGE", "JARDINAGE", "DERATISATION", "EAU", "ELECTRICITE", "INTERNET", "SYNDIC_PROFESSIONNEL", "TRAVAUX", "AUTRE"] as const;
export type TypeContrat = (typeof TYPES_CONTRAT)[number];
export const STATUTS_CONTRAT = ["BROUILLON", "ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"] as const;
export const PERIODICITES = ["MENSUELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE", "PONCTUELLE"] as const;
export type Periodicite = (typeof PERIODICITES)[number];
export const TYPES_ECHEANCE = ["PAIEMENT", "RENOUVELLEMENT", "VISITE_TECHNIQUE", "CONTROLE_REGLEMENTAIRE", "AUTRE"] as const;
export type TypeEcheance = (typeof TYPES_ECHEANCE)[number];
export const STATUTS_ECHEANCE = ["A_VENIR", "DEPENSE_GENEREE", "REALISEE", "MANQUEE", "ANNULEE"] as const;
export const TYPES_ASSURANCE: readonly TypeContrat[] = ["ASSURANCE_IMMEUBLE", "ASSURANCE_RC"];
export const estAssurance = (t: string) => (TYPES_ASSURANCE as readonly string[]).includes(t);

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "1250.50").');
const texteCourt = z.string().min(1).max(200);

export const pieceContratSchema = z.object({
  storage_path: z.string().regex(regexCheminModule("contrats"), "Chemin de fichier invalide."),
  nom: z.string().min(1).max(200),
});
export type PieceContratInput = z.infer<typeof pieceContratSchema>;

export const contratUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type ContratUploadUrlInput = z.infer<typeof contratUploadUrlSchema>;

export const detailsAssuranceSchema = z.object({
  assureur: z.string().min(1).max(200),
  numero_police: z.string().min(1).max(100),
  garanties: z.array(z.string().min(1).max(120)).max(30).default([]),
  franchise: montant.nullish(),
  capital_assure: montant.nullish(),
});
export type DetailsAssuranceInput = z.infer<typeof detailsAssuranceSchema>;

const contratBase = {
  prestataire_id: uuid.nullish(),
  reference: z.string().min(1).max(120).nullish(),
  date_fin: dateIso.nullish(),
  tacite: z.boolean().optional(),
  preavis_jours: z.number().int().min(0).max(730).nullish(),
  montant_periode: montant.nullish(),
  budget_poste_id: uuid.nullish(),
  resolution_ag_id: uuid.nullish(),
  notes: z.string().max(4000).nullish(),
  details_assurance: detailsAssuranceSchema.nullish(),
  // Contrat signé / attestation d'assurance téléversés via POST /contrats/upload-url.
  document: pieceContratSchema.nullish(),
  attestation: pieceContratSchema.nullish(),
};

function coherenceContrat(v: { type?: string; date_debut?: string; date_fin?: string | null; details_assurance?: unknown; tacite?: boolean }, ctx: z.RefinementCtx) {
  if (v.date_debut && v.date_fin && v.date_fin < v.date_debut) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_fin"], message: "La date de fin doit être postérieure ou égale à la date de début." });
  }
  if (v.type && !estAssurance(v.type) && v.details_assurance) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["details_assurance"], message: "Les détails d'assurance ne s'appliquent qu'aux contrats ASSURANCE_*." });
  }
  if (v.tacite && v.date_fin === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tacite"], message: "La reconduction tacite suppose une date de fin." });
  }
}

export const contratCreateSchema = z
  .object({
    ...contratBase,
    type: z.enum(TYPES_CONTRAT),
    libelle: texteCourt,
    date_debut: dateIso,
    periodicite: z.enum(PERIODICITES),
  })
  .superRefine(coherenceContrat);
export type ContratCreateInput = z.infer<typeof contratCreateSchema>;

export const contratUpdateSchema = z
  .object({
    ...contratBase,
    type: z.enum(TYPES_CONTRAT).optional(),
    libelle: texteCourt.optional(),
    date_debut: dateIso.optional(),
    periodicite: z.enum(PERIODICITES).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.")
  .superRefine(coherenceContrat);
export type ContratUpdateInput = z.infer<typeof contratUpdateSchema>;

export const contratResilierSchema = z.object({ motif: z.string().min(1).max(1000), date_resiliation: dateIso.optional() });
export type ContratResilierInput = z.infer<typeof contratResilierSchema>;
export const contratSuspendreSchema = z.object({ motif: z.string().min(1).max(1000).nullish() });
export type ContratSuspendreInput = z.infer<typeof contratSuspendreSchema>;

export const TRIS_CONTRAT = ["date_fin", "date_debut", "libelle", "montant_periode", "statut", "cree_le"] as const;
export const contratsFiltresSchema = z.object({
  type: z.enum(TYPES_CONTRAT).optional(),
  statut: z.enum(STATUTS_CONTRAT).optional(),
  prestataire_id: uuid.optional(),
  q: z.string().min(1).max(100).optional(),
});
export type ContratsFiltres = z.infer<typeof contratsFiltresSchema>;

export const echeancesGenererSchema = z.object({ horizon_mois: z.number().int().min(1).max(36).default(12) });
export type EcheancesGenererInput = z.infer<typeof echeancesGenererSchema>;

export const echeanceCreateSchema = z.object({
  type: z.enum(TYPES_ECHEANCE),
  date_echeance: dateIso,
  montant: montant.nullish(),
});
export type EcheanceCreateInput = z.infer<typeof echeanceCreateSchema>;

export const echeanceUpdateSchema = z
  .object({
    statut: z.enum(["REALISEE", "ANNULEE", "A_VENIR"]).optional(),
    date_echeance: dateIso.optional(),
    montant: montant.nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.");
export type EcheanceUpdateInput = z.infer<typeof echeanceUpdateSchema>;

export const genererDepenseSchema = z.object({
  montant_ttc: montant.optional(),
  date_depense: dateIso.optional(),
  source: z.enum(["COMPTE_COURANT", "FONDS_RESERVE"]).default("COMPTE_COURANT"),
});
export type GenererDepenseInput = z.infer<typeof genererDepenseSchema>;

export const echeancierQuerySchema = z.object({ from: dateIso, to: dateIso, type: z.enum(TYPES_ECHEANCE).optional(), statut: z.enum(STATUTS_ECHEANCE).optional() }).refine((v) => v.to >= v.from, "`to` doit être postérieur à `from`.");
export const aRenouvelerQuerySchema = z.object({ jours: z.coerce.number().int().min(1).max(730).default(90) });
