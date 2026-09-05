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

// M19 — appareils push (Master Spec Partie 13.4) : jeton FCM opaque, plateforme fermée.
export const appareilPushCreateSchema = z.object({
  token: z.string().min(20).max(4096),
  plateforme: z.enum(["ANDROID", "IOS"]),
  langue: z.enum(["FR", "AR"]).optional(),
  version_app: z.string().max(40).nullish(),
});
export type AppareilPushCreateInput = z.infer<typeof appareilPushCreateSchema>;
