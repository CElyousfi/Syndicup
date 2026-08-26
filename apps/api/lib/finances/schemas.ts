/**
 * Schémas Zod des payloads finances — M5 (Master Spec Partie 2.2/6, Doc A §3). Tout champ
 * monétaire est validé comme chaîne décimale (jamais un float JSON — CLAUDE.md §1.1 / Partie
 * 1.7.1) puis converti via apps/api/lib/money avant écriture.
 */
import { z } from "zod";

const decimalStringSchema = (opts: { maxDigitsAvantVirgule: number }) =>
  z
    .string()
    .regex(
      new RegExp(`^\\d{1,${opts.maxDigitsAvantVirgule}}(\\.\\d{1,2})?$`),
      "Montant décimal invalide (ex. \"12.50\")."
    );

export const TYPES_APPEL_DE_FONDS = [
  "CHARGES_COURANTES",
  "EXCEPTIONNEL",
  "FONDS_RESERVE",
  "REGULARISATION",
  "URGENCE",
  "DEMARRAGE",
] as const;

// Format "YYYY-MM" (Master Spec Partie 6.2) — clé d'idempotence avec type.
const periodeSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Période invalide (format "YYYY-MM").');

export const appelDeFondsGenererSchema = z.object({
  periode: periodeSchema,
  type: z.enum(TYPES_APPEL_DE_FONDS),
  montant_total: decimalStringSchema({ maxDigitsAvantVirgule: 12 }),
  date_echeance: z.string().date(),
});
export type AppelDeFondsGenererInput = z.infer<typeof appelDeFondsGenererSchema>;

export const MODES_PAIEMENT_MANUEL = ["VIREMENT", "ESPECES", "CHEQUE"] as const;

// Deux modes exclusifs (Doc A §3.4) : ciblé (appel_de_fonds_lot_id) ou FIFO (lot_id).
export const paiementManuelCreateSchema = z
  .object({
    appel_de_fonds_lot_id: z.string().uuid().optional(),
    lot_id: z.string().uuid().optional(),
    montant: decimalStringSchema({ maxDigitsAvantVirgule: 12 }),
    methode: z.enum(MODES_PAIEMENT_MANUEL),
    payeur_utilisateur_id: z.string().uuid().nullish(),
    accepter_trop_percu: z.boolean().optional().default(false),
  })
  .refine(
    (v) => (v.appel_de_fonds_lot_id ? 1 : 0) + (v.lot_id ? 1 : 0) === 1,
    "Fournir exactement un de appel_de_fonds_lot_id (paiement ciblé) ou lot_id (imputation FIFO)."
  );
export type PaiementManuelCreateInput = z.infer<typeof paiementManuelCreateSchema>;

export const paiementCmiInitierSchema = z.object({
  appel_de_fonds_lot_id: z.string().uuid(),
  montant: decimalStringSchema({ maxDigitsAvantVirgule: 12 }),
});
export type PaiementCmiInitierInput = z.infer<typeof paiementCmiInitierSchema>;

// Payload webhook CMI — champs génériques (oid/montant/hash), à ajuster à la nomenclature exacte
// du contrat commerçant CMI une fois les credentials réels disponibles (voir finances.ts).
export const paiementCmiWebhookSchema = z.object({
  oid: z.string().min(1),
  montant: decimalStringSchema({ maxDigitsAvantVirgule: 12 }),
  hash: z.string().min(1),
  procreturncode: z.string().optional(),
});
export type PaiementCmiWebhookInput = z.infer<typeof paiementCmiWebhookSchema>;

export const contestationChargeCreateSchema = z.object({
  appel_de_fonds_lot_id: z.string().uuid(),
  motif: z.string().min(1),
});
export type ContestationChargeCreateInput = z.infer<typeof contestationChargeCreateSchema>;

export const contestationChargeRepondreSchema = z.object({
  statut: z.enum(["REPONDUE", "MEDIEE", "TRIBUNAL"]),
  reponse_syndic: z.string().min(1),
});
export type ContestationChargeRepondreInput = z.infer<typeof contestationChargeRepondreSchema>;

// ── M12 — Budgets AG (Master Spec Partie 2.2, Doc A §3.2) ────────────────────
const exerciceSchema = z.string().regex(/^\d{4}$/, 'Exercice invalide (format "YYYY").');

export const budgetAgCreateSchema = z.object({
  exercice: exerciceSchema,
  montant_total: decimalStringSchema({ maxDigitsAvantVirgule: 12 }),
  ag_id: z.string().uuid().nullish(),
});
export type BudgetAgCreateInput = z.infer<typeof budgetAgCreateSchema>;

export const budgetAgUpdateSchema = z
  .object({
    montant_total: decimalStringSchema({ maxDigitsAvantVirgule: 12 }).optional(),
    ag_id: z.string().uuid().nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type BudgetAgUpdateInput = z.infer<typeof budgetAgUpdateSchema>;
