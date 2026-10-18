/**
 * Schémas Zod des payloads documents — M9 (Master Spec Partie 9, Doc A §12.3).
 */
import { z } from "zod";

/**
 * Types acceptés pour un document de la copropriété : la même liste image + PDF que les autres
 * upload-url (contrats, dépenses, justificatifs…), plus les formats bureautiques usuels
 * (Word, Excel, texte) — un règlement, un devis ou un tableau de charges arrive souvent ainsi.
 */
export const DOCUMENT_CONTENT_TYPE_RE =
  /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|application\/vnd\.ms-excel|text\/plain|text\/csv)$/;

export const documentUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(200),
  content_type: z
    .string()
    .regex(
      DOCUMENT_CONTENT_TYPE_RE,
      "Format non pris en charge : image (JPEG, PNG, WebP, HEIC), PDF, Word, Excel ou texte uniquement."
    ),
});
export type DocumentUploadUrlInput = z.infer<typeof documentUploadUrlSchema>;

export const documentCreateSchema = z.object({
  type: z.string().min(1),
  nom: z.string().min(1),
  visibilite: z.enum(["PUBLIC_COPROPRIETE", "SYNDIC_ONLY", "CONSEIL_SYNDICAL"]),
  storage_path: z.string().min(1),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
