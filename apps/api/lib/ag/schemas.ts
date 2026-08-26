/**
 * Schémas Zod des payloads Assemblées Générales — M6 (Master Spec Partie 2.2/8, Doc A §6).
 * Alignés sur packages/api-contract/openapi.yaml.
 */
import { z } from "zod";

export const TYPES_AG = ["ORDINAIRE", "EXTRAORDINAIRE", "REVOCATION"] as const;
export const TYPES_MAJORITE_AG = ["SIMPLE", "DOUBLE", "UNANIMITE"] as const;
export const VALEURS_VOTE_AG = ["POUR", "CONTRE", "ABSTENTION"] as const;

export const agCreateSchema = z.object({
  type: z.enum(TYPES_AG),
  date_ag: z.string().datetime(),
});
export type AgCreateInput = z.infer<typeof agCreateSchema>;

export const agAnnulerSchema = z.object({
  motif: z.string().min(1),
});
export type AgAnnulerInput = z.infer<typeof agAnnulerSchema>;

export const agResolutionCreateSchema = z.object({
  ordre: z.number().int().min(1),
  texte: z.string().min(1),
  type_majorite: z.enum(TYPES_MAJORITE_AG),
});
export type AgResolutionCreateInput = z.infer<typeof agResolutionCreateSchema>;

export const agVoteCreateSchema = z.object({
  resolution_id: z.string().uuid(),
  lot_id: z.string().uuid().nullish(),
  valeur: z.enum(VALEURS_VOTE_AG),
  procuration_id: z.string().uuid().nullish(),
});
export type AgVoteCreateInput = z.infer<typeof agVoteCreateSchema>;

// mandant_id : optionnel, réservé au syndic pour enregistrer une procuration papier reçue pour le
// compte d'un mandant (Doc A §6.5) — un PROPRIETAIRE/INDIVISAIRE ne peut créer que la sienne
// (vérifié côté service, pas ici).
export const agProcurationCreateSchema = z.object({
  lot_id: z.string().uuid(),
  mandataire_id: z.string().uuid(),
  mandant_id: z.string().uuid().nullish(),
});
export type AgProcurationCreateInput = z.infer<typeof agProcurationCreateSchema>;
