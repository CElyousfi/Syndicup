/**
 * Schémas Zod copropriétés — M12 (Master Spec Partie 2.2, tenant racine).
 * Les paramètres légaux restent nullable : Zod valide le TYPE, jamais une valeur par défaut
 * devinée (LEGAL_QUESTIONS_BRIEF §1/§2/§4 — CLAUDE.md §2).
 */
import { z } from "zod";

export const TYPES_RESIDENCE = [
  "IMMEUBLE_COLLECTIF",
  "RESIDENCE_FERMEE",
  "RESIDENCE_VILLAS",
  "IMMEUBLE_BUREAUX",
  "IMMEUBLE_MIXTE",
  "RESIDENCE_ETUDIANTE",
] as const;

const decimalString = (regex: RegExp, message: string) => z.string().regex(regex, message);

export const coproprieteCreateSchema = z.object({
  nom: z.string().min(1).max(200),
  adresse: z.string().min(1).max(500),
  ville: z.string().min(1).max(100),
  type_residence: z.enum(TYPES_RESIDENCE),
  nb_lots: z.number().int().min(1).max(10000),
  config_json: z.record(z.unknown()).nullish(),
});
export type CoproprieteCreateInput = z.infer<typeof coproprieteCreateSchema>;

export const coproprieteUpdateSchema = z
  .object({
    nom: z.string().min(1).max(200).optional(),
    adresse: z.string().min(1).max(500).optional(),
    ville: z.string().min(1).max(100).optional(),
    nb_lots: z.number().int().min(1).max(10000).optional(),
    config_json: z.record(z.unknown()).nullish(),
    // Logo (M18) : chemin `<copropriete>/branding/…` du bucket privé ; null = retirer le logo.
    logo_storage_path: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/branding\/[A-Za-z0-9._-]{1,120}$/i, "Chemin de logo invalide.")
      .nullish(),
    politique_recouvrement_json: z.record(z.unknown()).nullish(),
    total_tantiemes: decimalString(
      /^\d{1,12}(\.\d{1,2})?$/,
      'Total tantièmes décimal invalide (ex. "10000").'
    ).nullish(),
    // Paramètres légaux — la VALEUR saisie doit être juridiquement confirmée (le PATCH trace
    // l'avant/après en audit) ; null = retour à l'état "non configuré" (422 sur les endpoints AG).
    delai_convocation_jours: z.number().int().min(1).max(365).nullish(),
    quorum_premiere_convocation: decimalString(
      /^(0\.\d{1,3}|1(\.0{1,3})?)$/,
      'Quorum invalide (ratio "0.500" à "1").'
    ).nullish(),
    limite_procurations_mandataire: z.number().int().min(1).max(100).nullish(),
    retention_desactivation_mois: z.number().int().min(1).max(240).nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Aucun champ à modifier.");
export type CoproprieteUpdateInput = z.infer<typeof coproprieteUpdateSchema>;

export const logoUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(120),
  content_type: z.string().regex(/^image\/(jpeg|png|webp|svg\+xml)$/, "Seules les images sont acceptées."),
});
export type LogoUploadUrlInput = z.infer<typeof logoUploadUrlSchema>;
