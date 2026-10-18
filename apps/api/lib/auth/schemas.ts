/**
 * Schémas Zod des payloads auth/onboarding — validation stricte avant toute écriture
 * (CLAUDE.md §1.5 / Master Spec Partie 1.7.5). Alignés sur packages/api-contract/openapi.yaml.
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  mot_de_passe: z.string().min(8),
});

/** Mot de passe oublié : l'e-mail suffit ; la réponse est identique que l'adresse existe ou non. */
export const motDePasseOublieSchema = z.object({
  email: z.string().email().max(200),
  langue: z.enum(["fr", "ar"]).default("fr"),
});

/** Réinitialisation : `token_hash` du lien reçu par e-mail + nouveau mot de passe. */
export const motDePasseReinitialiserSchema = z.object({
  token_hash: z.string().min(16).max(512),
  mot_de_passe: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

/** `jeton` : jeton d'ouverture de l'appareil (usage unique, M17) — facultatif mais requis dès
 *  que le code a été ouvert : sans lui, le code est considéré consommé. */
export const inviteAcceptSchema = z.object({
  code: z.string().min(1),
  jeton: z.string().min(16).max(128).optional(),
});

/**
 * Inscription par invitation (scan du QR / saisie du code) : l'invité crée son compte et
 * ses identifiants dans le même geste — le code (usage unique) est la preuve d'identité.
 */
export const inviteInscriptionSchema = z.object({
  code: z.string().min(4).max(16),
  email: z.string().email().max(200),
  mot_de_passe: z.string().min(8).max(128),
  prenom: z.string().min(1).max(100),
  nom: z.string().min(1).max(100),
  langue_preferee: z.enum(["FR", "AR"]).default("FR"),
  jeton: z.string().min(16).max(128).optional(),
});
export type InviteInscriptionInput = z.infer<typeof inviteInscriptionSchema>;

// SUPER_ADMIN volontairement absent : jamais attribué par invitation (Partie 5.3 —
// pas d'auto-élévation de privilège).
export const ROLES_INVITABLES = [
  "SYNDIC",
  "CONSEIL_SYNDICAL",
  "PROPRIETAIRE",
  "LOCATAIRE",
  "INDIVISAIRE",
  "GARDIEN",
  "PRESTATAIRE",
  "PERSONNE_MORALE_REPRESENTANT",
  // M15 — gestionnaire LCD : invité par le propriétaire pour UN lot (lot_id obligatoire).
  "GESTIONNAIRE_LCD",
] as const;

// Rôles rattachés directement à la copropriété — lot_id interdit (Partie 5.3) ; pour tous les
// autres, lot_id est OBLIGATOIRE.
export const ROLES_SANS_LOT = ["SYNDIC", "GARDIEN", "PRESTATAIRE"] as const;

export const invitationCreateSchema = z
  .object({
    lot_id: z.string().uuid().nullish(),
    role_cible: z.enum(ROLES_INVITABLES),
    canal: z.enum(["EMAIL", "SMS", "QR_CODE", "WHATSAPP"]),
  })
  .superRefine((val, ctx) => {
    const sansLot = (ROLES_SANS_LOT as readonly string[]).includes(val.role_cible);
    if (sansLot && val.lot_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lot_id"],
        message: `lot_id interdit pour le rôle ${val.role_cible} (rattaché à la copropriété, Master Spec Partie 5.3).`,
      });
    }
    if (!sansLot && !val.lot_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lot_id"],
        message: `lot_id obligatoire pour le rôle ${val.role_cible} (Partie 5.3).`,
      });
    }
  });

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;
