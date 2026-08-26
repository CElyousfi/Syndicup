/**
 * Schémas Zod — M11 Litiges (Master Spec Partie 2.2, Doc A §12.1).
 */
import { z } from "zod";

export const litigeCreateSchema = z.object({
  type: z.string().min(1).max(120),
  description: z.string().min(1).max(5000),
});
export type LitigeCreateInput = z.infer<typeof litigeCreateSchema>;

// L'escalade est monotone (niveau + 1, jamais de saut ni de retour) — pas de payload de niveau
// cible : le service calcule la transition, le motif est obligatoire (valeur probante).
export const litigeEscaladerSchema = z.object({
  motif: z.string().min(1).max(2000),
});
export type LitigeEscaladerInput = z.infer<typeof litigeEscaladerSchema>;

export const litigeResoudreSchema = z.object({
  statut: z.enum(["RESOLU", "CLOS"]),
  motif: z.string().min(1).max(2000),
});
export type LitigeResoudreInput = z.infer<typeof litigeResoudreSchema>;
