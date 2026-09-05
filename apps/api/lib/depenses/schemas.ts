/**
 * Schémas Zod — M16 Dépenses, factures, postes budgétaires (Doc A §3, §8). Validation stricte de
 * chaque payload (CLAUDE.md §1.5) : montants en chaînes décimales (jamais un float JSON), enums
 * fermés, aucun défaut deviné sur un champ sensible (source de financement, statut…).
 */
import { z } from "zod";
import { add, isEqual } from "../money";
import { regexCheminModule } from "../documents/attach";

export const CATEGORIES_DEPENSE = [
  "ENTRETIEN_COURANT",
  "REPARATIONS",
  "TRAVAUX",
  "PERSONNEL",
  "ENERGIE_EAU",
  "ASSURANCE",
  "HONORAIRES_SYNDIC",
  "ADMINISTRATIF",
  "IMPOTS_TAXES",
  "AUTRE",
] as const;
export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number];
export const STATUTS_DEPENSE = ["BROUILLON", "A_APPROUVER", "APPROUVEE", "REJETEE", "PAYEE", "ANNULEE"] as const;
export const SOURCES_FINANCEMENT = ["COMPTE_COURANT", "FONDS_RESERVE"] as const;
export const STATUTS_FACTURE = ["RECUE", "VERIFIEE", "CONTESTEE", "REGLEE"] as const;
/** Méthodes de paiement SORTANT : jamais CMI (encaissement uniquement). */
export const METHODES_PAIEMENT_DEPENSE = ["VIREMENT", "CHEQUE", "ESPECES"] as const;

const uuid = z.string().uuid();
const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD.");
const exercice = z.string().regex(/^\d{4}$/, 'Exercice invalide (format "YYYY").');
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Montant décimal invalide (ex. "1250.50").');
const montantPositif = montant.refine((v) => Number(v) > 0, "Le montant doit être strictement positif.");
const texteCourt = z.string().min(1).max(200);
const texteLong = z.string().min(1).max(2000);

// ── Postes budgétaires ───────────────────────────────────────────────────────
export const budgetPosteCreateSchema = z.object({
  categorie: z.enum(CATEGORIES_DEPENSE),
  libelle: z.string().min(1).max(120),
  montant_prevu: montant,
  ordre: z.number().int().min(0).max(1000).optional(),
});
export type BudgetPosteCreateInput = z.infer<typeof budgetPosteCreateSchema>;

export const budgetPosteUpdateSchema = z
  .object({
    categorie: z.enum(CATEGORIES_DEPENSE).optional(),
    libelle: z.string().min(1).max(120).optional(),
    montant_prevu: montant.optional(),
    ordre: z.number().int().min(0).max(1000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.");
export type BudgetPosteUpdateInput = z.infer<typeof budgetPosteUpdateSchema>;

// ── Dépenses ─────────────────────────────────────────────────────────────────
/** HT + TVA = TTC quand les deux sont fournis (cohérence avec la facture, à la centime). */
function montantsCoherents(v: { montant_ht?: string | null; tva?: string | null; montant_ttc?: string }, ctx: z.RefinementCtx) {
  const ht = v.montant_ht ?? null;
  const tva = v.tva ?? null;
  if ((ht === null) !== (tva === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tva"], message: "Fournir montant_ht ET tva, ou aucun des deux." });
    return;
  }
  if (ht !== null && tva !== null && v.montant_ttc && !isEqual(add(ht, tva), v.montant_ttc)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["montant_ttc"], message: "montant_ttc doit être égal à montant_ht + tva." });
  }
}

const depenseBase = {
  libelle: texteCourt,
  description: texteLong.nullish(),
  montant_ht: montant.nullish(),
  tva: montant.nullish(),
  budget_poste_id: uuid.nullish(),
  prestataire_id: uuid.nullish(),
  incident_id: uuid.nullish(),
  resolution_ag_id: uuid.nullish(),
};

export const depenseCreateSchema = z
  .object({
    ...depenseBase,
    categorie: z.enum(CATEGORIES_DEPENSE),
    montant_ttc: montantPositif,
    date_depense: dateIso,
    // Pas de défaut silencieux : la source de financement est un choix explicite (Doc A §3.6).
    source: z.enum(SOURCES_FINANCEMENT),
  })
  .superRefine(montantsCoherents);
export type DepenseCreateInput = z.infer<typeof depenseCreateSchema>;

export const depenseUpdateSchema = z
  .object({
    ...depenseBase,
    libelle: texteCourt.optional(),
    categorie: z.enum(CATEGORIES_DEPENSE).optional(),
    montant_ttc: montantPositif.optional(),
    date_depense: dateIso.optional(),
    source: z.enum(SOURCES_FINANCEMENT).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.")
  .superRefine(montantsCoherents);
export type DepenseUpdateInput = z.infer<typeof depenseUpdateSchema>;

export const depenseRejeterSchema = z.object({ motif: z.string().min(1).max(1000) });
export type DepenseRejeterInput = z.infer<typeof depenseRejeterSchema>;

export const depenseAnnulerSchema = z.object({ motif: z.string().min(1).max(1000).nullish() });
export type DepenseAnnulerInput = z.infer<typeof depenseAnnulerSchema>;

/** Fichier déjà téléversé (URL signée obtenue via POST /depenses/upload-url). */
export const pieceDepenseSchema = z.object({
  storage_path: z.string().regex(regexCheminModule("depenses"), "Chemin de fichier invalide."),
  nom: z.string().min(1).max(200),
});
export type PieceDepenseInput = z.infer<typeof pieceDepenseSchema>;

export const depensePayerSchema = z
  .object({
    methode: z.enum(METHODES_PAIEMENT_DEPENSE),
    reference: z.string().min(1).max(120).nullish(),
    date_paiement: dateIso,
    justificatif: pieceDepenseSchema.nullish(),
  })
  .superRefine((v, ctx) => {
    // Virement / chèque : la référence est la clé du rapprochement bancaire manuel (aucune API
    // bancaire — décision projet) ; les espèces n'en ont pas.
    if (v.methode !== "ESPECES" && !v.reference) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reference"], message: "Référence de virement / numéro de chèque obligatoire." });
    }
  });
export type DepensePayerInput = z.infer<typeof depensePayerSchema>;

export const depenseUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(180),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/, "Image ou PDF uniquement."),
});
export type DepenseUploadUrlInput = z.infer<typeof depenseUploadUrlSchema>;

// ── Factures ─────────────────────────────────────────────────────────────────
export const factureCreateSchema = z
  .object({
    numero: z.string().min(1).max(80).nullish(),
    date_facture: dateIso,
    date_echeance: dateIso.nullish(),
    montant_ttc: montantPositif,
    prestataire_id: uuid.nullish(),
    document: pieceDepenseSchema,
  })
  .superRefine((v, ctx) => {
    if (v.date_echeance && v.date_echeance < v.date_facture) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_echeance"], message: "L'échéance ne peut pas précéder la date de facture." });
    }
  });
export type FactureCreateInput = z.infer<typeof factureCreateSchema>;

export const factureUpdateSchema = z.object({ statut: z.enum(STATUTS_FACTURE) });
export type FactureUpdateInput = z.infer<typeof factureUpdateSchema>;

// ── Filtres de liste ─────────────────────────────────────────────────────────
export const TRIS_DEPENSE = ["date_depense", "montant_ttc", "statut", "cree_le"] as const;
export const depensesFiltresSchema = z.object({
  statut: z.enum(STATUTS_DEPENSE).optional(),
  categorie: z.enum(CATEGORIES_DEPENSE).optional(),
  budget_poste_id: uuid.optional(),
  prestataire_id: uuid.optional(),
  source: z.enum(SOURCES_FINANCEMENT).optional(),
  incident_id: uuid.optional(),
  contrat_id: uuid.optional(),
  personnel_id: uuid.optional(),
  date_from: dateIso.optional(),
  date_to: dateIso.optional(),
  exercice: exercice.optional(),
  q: z.string().min(1).max(100).optional(),
});
export type DepensesFiltres = z.infer<typeof depensesFiltresSchema>;

export const budgetVsRealiseQuerySchema = z.object({ exercice: exercice.optional() });

// ── Incidents → dépense / évaluation ─────────────────────────────────────────
export const incidentDepenseCreateSchema = z
  .object({
    montant_ttc: montantPositif,
    montant_ht: montant.nullish(),
    tva: montant.nullish(),
    libelle: texteCourt.optional(),
    description: texteLong.nullish(),
    budget_poste_id: uuid.nullish(),
    date_depense: dateIso.optional(),
    source: z.enum(SOURCES_FINANCEMENT).default("COMPTE_COURANT"),
  })
  .superRefine(montantsCoherents);
export type IncidentDepenseCreateInput = z.infer<typeof incidentDepenseCreateSchema>;

export const incidentEvaluationSchema = z.object({
  note: z.number().int().min(1).max(5),
  commentaire: z.string().min(1).max(1000).nullish(),
});
export type IncidentEvaluationInput = z.infer<typeof incidentEvaluationSchema>;
