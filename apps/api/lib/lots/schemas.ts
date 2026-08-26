/**
 * Schémas Zod des payloads lots/propriété/occupation — M3 (Master Spec Partie 2.2, Doc A §1, §2).
 * Alignés sur packages/api-contract/openapi.yaml. Tout champ monétaire (tantiemes, quote_part)
 * est validé comme chaîne décimale (jamais un float JSON — CLAUDE.md §1.1 / Partie 1.7.1) puis
 * converti via apps/api/lib/money avant écriture.
 */
import { z } from "zod";

const decimalStringSchema = (opts: { maxDigitsAvantVirgule: number }) =>
  z
    .string()
    .regex(
      new RegExp(`^\\d{1,${opts.maxDigitsAvantVirgule}}(\\.\\d{1,2})?$`),
      "Montant décimal invalide (ex. \"12.50\")."
    );

export const TYPES_LOT = [
  "APPARTEMENT",
  "PARKING",
  "CAVE",
  "LOCAL",
  "TOIT_TERRASSE",
  "VILLA",
  "COMMERCIAL",
  "BUREAU",
  "LOGE_GARDIEN",
] as const;

export const STATUTS_LOT = [
  "OCCUPE",
  "VACANT",
  "ORPHELIN",
  "EN_SUCCESSION",
  "SINISTRE",
  "TANTIEME_A_REGULARISER",
] as const;

export const TYPES_USAGE_LOT = ["HABITATION", "BUREAU", "MIXTE", "COMMERCIAL"] as const;

export const lotCreateSchema = z.object({
  type_lot: z.enum(TYPES_LOT),
  type_usage: z.enum(TYPES_USAGE_LOT).nullish(),
  numero: z.string().min(1),
  etage: z.number().int().nullish(),
  tantiemes: decimalStringSchema({ maxDigitsAvantVirgule: 12 }),
  superficie: decimalStringSchema({ maxDigitsAvantVirgule: 8 }).nullish(),
  lot_parent_id: z.string().uuid().nullish(),
});
export type LotCreateInput = z.infer<typeof lotCreateSchema>;

export const lotUpdateSchema = z.object({
  type_lot: z.enum(TYPES_LOT).optional(),
  type_usage: z.enum(TYPES_USAGE_LOT).nullish(),
  numero: z.string().min(1).optional(),
  etage: z.number().int().nullish(),
  tantiemes: decimalStringSchema({ maxDigitsAvantVirgule: 12 }).optional(),
  superficie: decimalStringSchema({ maxDigitsAvantVirgule: 8 }).nullish(),
  statut: z.enum(STATUTS_LOT).optional(),
  lot_parent_id: z.string().uuid().nullish(),
});
export type LotUpdateInput = z.infer<typeof lotUpdateSchema>;

export const TYPES_PROPRIETE = ["PLEIN", "INDIVISION", "SCI"] as const;

// quote_part : numeric(5,2) côté DB → 3 chiffres avant la virgule max (100.00).
export const lotProprietaireCreateSchema = z.object({
  utilisateur_id: z.string().uuid(),
  quote_part: decimalStringSchema({ maxDigitsAvantVirgule: 3 }),
  type_propriete: z.enum(TYPES_PROPRIETE),
  est_representant_indivision: z.boolean().optional().default(false),
  date_debut: z.string().date(),
  date_fin: z.string().date().nullish(),
});
export type LotProprietaireCreateInput = z.infer<typeof lotProprietaireCreateSchema>;

export const TYPES_OCCUPATION = ["PROPRIETAIRE_OCCUPANT", "LOCATAIRE"] as const;

export const lotOccupantCreateSchema = z.object({
  utilisateur_id: z.string().uuid(),
  type_occupation: z.enum(TYPES_OCCUPATION),
  date_debut: z.string().date(),
  date_fin: z.string().date().nullish(),
  acces_finances_accorde: z.boolean().optional().default(false),
  recoit_convocations: z.boolean().optional().default(false),
});
export type LotOccupantCreateInput = z.infer<typeof lotOccupantCreateSchema>;

// M4 (Master Spec Partie 5.4). dette_reprise_acquereur est REQUIS (pas de défaut) : la
// vérification automatique du solde de charges dépend du moteur financier (M5, pas encore
// livré — voir apps/api/lib/lots/lots.ts::transfererPropriete) ; en attendant, le syndic doit
// attester explicitement l'arrangement plutôt que de laisser un défaut silencieux trancher.
export const lotTransfertProprieteSchema = z
  .object({
    nouveau_proprietaire: z.object({
      email: z.string().email().nullish(),
      telephone: z.string().nullish(),
    }),
    dette_reprise_acquereur: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (!val.nouveau_proprietaire.email && !val.nouveau_proprietaire.telephone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nouveau_proprietaire"],
        message: "email ou telephone requis pour inviter le nouveau propriétaire.",
      });
    }
  });
export type LotTransfertProprieteInput = z.infer<typeof lotTransfertProprieteSchema>;
