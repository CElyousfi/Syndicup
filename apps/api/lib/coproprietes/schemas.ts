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

/**
 * Emplacements photo personnalisables (M20). Clés fixes + `espace:<uuid>` (photo d'un espace
 * commun). Les clients affichent leur image par défaut pour tout emplacement absent.
 */
export const CLES_PHOTO = ["accueil", "entree", "cour", "salle", "piscine"] as const;
export type ClePhoto = (typeof CLES_PHOTO)[number];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const clePhotoSchema = z
  .string()
  .regex(new RegExp(`^(${CLES_PHOTO.join("|")}|espace:${UUID})$`, "i"), "Emplacement photo inconnu.");
const cheminBrandingSchema = z
  .string()
  .regex(new RegExp(`^${UUID}/branding/[A-Za-z0-9._-]{1,120}$`, "i"), "Chemin d'image invalide.");

export const coproprieteUpdateSchema = z
  .object({
    nom: z.string().min(1).max(200).optional(),
    adresse: z.string().min(1).max(500).optional(),
    ville: z.string().min(1).max(100).optional(),
    nb_lots: z.number().int().min(1).max(10000).optional(),
    config_json: z.record(z.unknown()).nullish(),
    // Logo (M18) : chemin `<copropriete>/branding/…` du bucket privé ; null = retirer le logo.
    logo_storage_path: cheminBrandingSchema.nullish(),
    // Photos de la résidence (M20) : `{ cle: chemin }`, même périmètre que le logo ; null = tout retirer.
    photos_json: z.record(clePhotoSchema, cheminBrandingSchema).nullish(),
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

/** POST /coproprietes/:id/photos/upload-url — même contrat que le logo, plus l'emplacement visé. */
export const photoUploadUrlSchema = logoUploadUrlSchema.extend({ cle: clePhotoSchema });
export type PhotoUploadUrlInput = z.infer<typeof photoUploadUrlSchema>;
