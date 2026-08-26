/**
 * Schémas Zod utilisateurs — M13 (CNDP, Master Spec Partie 10.1).
 * email/telephone sont des identifiants d'authentification Supabase — jamais modifiables ici.
 */
import { z } from "zod";

export const profilUpdateSchema = z
  .object({
    nom: z.string().min(1).max(100).optional(),
    prenom: z.string().min(1).max(100).optional(),
    langue_preferee: z.enum(["FR", "AR"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Aucun champ à modifier.");
export type ProfilUpdateInput = z.infer<typeof profilUpdateSchema>;
