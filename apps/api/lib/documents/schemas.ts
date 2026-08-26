/**
 * Schémas Zod des payloads documents — M9 (Master Spec Partie 9, Doc A §12.3).
 */
import { z } from "zod";

export const documentCreateSchema = z.object({
  type: z.string().min(1),
  nom: z.string().min(1),
  visibilite: z.enum(["PUBLIC_COPROPRIETE", "SYNDIC_ONLY", "CONSEIL_SYNDICAL"]),
  storage_path: z.string().min(1),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
