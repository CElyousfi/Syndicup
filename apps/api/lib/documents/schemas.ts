/**
 * Schémas Zod des payloads documents — M9 (Master Spec Partie 9, Doc A §12.3).
 */
import { z } from "zod";

/**
 * Types acceptés pour un document de la copropriété — volontairement large pour ne casser aucun
 * usage existant : images (dont GIF), vidéos (le sélecteur mobile `pickMedia` peut en renvoyer),
 * PDF, bureautique Microsoft et OpenDocument, RTF, texte/CSV, archives ZIP. Exclut les types
 * exécutables ou interprétables par le navigateur (HTML, SVG, JS, binaires).
 */
export const DOCUMENT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
] as const;

const TYPES_ACCEPTES = new Set<string>(DOCUMENT_CONTENT_TYPES);

export const documentUploadUrlSchema = z.object({
  nom_fichier: z.string().min(1).max(200),
  content_type: z
    .string()
    .max(150)
    // Insensible à la casse et aux paramètres (« application/PDF; charset=… ») envoyés par certains clients.
    .refine((t) => TYPES_ACCEPTES.has(t.split(";")[0]!.trim().toLowerCase()), {
      message:
        "Format non pris en charge : image, vidéo (MP4, MOV, WebM), PDF, Word, Excel, PowerPoint, OpenDocument, RTF, texte ou ZIP.",
    }),
});
export type DocumentUploadUrlInput = z.infer<typeof documentUploadUrlSchema>;

export const documentCreateSchema = z.object({
  type: z.string().min(1),
  nom: z.string().min(1),
  visibilite: z.enum(["PUBLIC_COPROPRIETE", "SYNDIC_ONLY", "CONSEIL_SYNDICAL"]),
  storage_path: z.string().min(1),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
