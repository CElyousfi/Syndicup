/**
 * Service invitations — Master Spec Partie 5.1 (canaux/expirations), 5.3 (attribution de rôle),
 * 5.5 (edge cases). Émission/liste/régénération : tenant-scopé via withTenant (syndic).
 * Acceptation : fonction SQL SECURITY DEFINER `invitation_accepter` (l'invité n'a pas encore de
 * contexte tenant) — voir migration m2.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { can } from "./permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import type { InvitationCreateInput } from "./schemas";

export class PermissionRefuseeError extends Error {}
export class InvitationIntrouvableError extends Error {}
export class InvitationDejaAccepteeError extends Error {}

/**
 * Expiration par canal — Master Spec Partie 5.1 : email 7 jours, SMS 48h, WhatsApp = même
 * contenu que SMS donc 48h. QR_CODE : non spécifié (affichage hall, onboarding en masse) —
 * HYPOTHÈSE : 30 jours, à confirmer produit ; signalée ici plutôt que devinée silencieusement.
 */
const EXPIRATION_HEURES: Record<InvitationCreateInput["canal"], number> = {
  EMAIL: 7 * 24,
  SMS: 48,
  WHATSAPP: 48,
  QR_CODE: 30 * 24,
};

/** Code 8 caractères (Partie 5.1), alphabet sans ambiguïté (pas de O/0, I/1), crypto-sûr. */
export function genererCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function expiration(canal: InvitationCreateInput["canal"]): Date {
  return new Date(Date.now() + EXPIRATION_HEURES[canal] * 3600 * 1000);
}

export async function creerInvitation(ctx: TenantContext, input: InvitationCreateInput) {
  if (can("onboarding.inviter", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut émettre une invitation (Partie 5.3).");
  }
  return withTenant(ctx, (db) =>
    db.invitation.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: input.lot_id ?? null,
        roleCible: input.role_cible,
        emetteurId: ctx.utilisateurId,
        canal: input.canal,
        code: genererCode(),
        expireLe: expiration(input.canal),
      },
    })
  );
}

export async function listerInvitations(ctx: TenantContext, page: number, limit: number) {
  if (can("onboarding.lister_invitations", ctx.role) !== true) {
    throw new PermissionRefuseeError("Réservé au syndic.");
  }
  return withTenant(ctx, async (db) => {
    const [total, rows] = await Promise.all([
      db.invitation.count({ where: { coproprieteId: ctx.coproprieteId } }),
      db.invitation.findMany({
        where: { coproprieteId: ctx.coproprieteId },
        orderBy: { creeLe: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, rows };
  });
}

/**
 * Régénère un code sans recréer le lot (Partie 5.5) : l'ancienne invitation passe à REGENEREE,
 * une nouvelle est créée avec les mêmes paramètres.
 */
export async function regenererInvitation(ctx: TenantContext, invitationId: string) {
  if (can("onboarding.inviter", ctx.role) !== true) {
    throw new PermissionRefuseeError("Réservé au syndic.");
  }
  return withTenant(ctx, async (db) => {
    const ancienne = await db.invitation.findUnique({ where: { id: invitationId } });
    if (!ancienne || ancienne.coproprieteId !== ctx.coproprieteId) {
      throw new InvitationIntrouvableError("Invitation introuvable.");
    }
    if (ancienne.statut === "ACCEPTEE") {
      throw new InvitationDejaAccepteeError("Déjà acceptée — rien à régénérer.");
    }
    await db.invitation.update({
      where: { id: ancienne.id },
      data: { statut: "REGENEREE" },
    });
    return db.invitation.create({
      data: {
        coproprieteId: ancienne.coproprieteId,
        lotId: ancienne.lotId,
        roleCible: ancienne.roleCible,
        emetteurId: ctx.utilisateurId,
        canal: ancienne.canal,
        code: genererCode(),
        expireLe: expiration(ancienne.canal),
      },
    });
  });
}

// ─── Acceptation (invité, pas encore de contexte tenant) ────────────────────

export type ResultatAcceptation =
  | {
      statut: "OK";
      copropriete_id: string;
      lot_id: string | null;
      role: string;
      statut_compte: string;
    }
  | {
      statut:
        | "INVALIDE"
        | "DEJA_UTILISEE"
        | "EXPIREE"
        | "EMAIL_DEJA_UTILISE"
        | "TELEPHONE_DEJA_UTILISE"
        | "CONFLIT_SYNDIC";
    };

/**
 * Client dédié à l'unique RPC SECURITY DEFINER invitation_accepter — même rôle Postgres
 * applicatif (sans BYPASSRLS) que le wrapper tenant. Exception encadrée au principe
 * "tout passe par withTenant" : l'invité n'a par définition pas encore de tenant, et la fonction
 * SQL est elle-même atomique et fermée (REVOKE ALL, GRANT application_role uniquement).
 * NE PAS utiliser ce client pour autre chose.
 */
const rpcClient = new PrismaClient();

export async function accepterInvitation(params: {
  utilisateurId: string;
  email: string | null;
  telephone: string | null;
  identiteVerifiee: boolean;
}, code: string): Promise<ResultatAcceptation> {
  const rows = await rpcClient.$queryRaw<{ resultat: ResultatAcceptation }[]>`
    SELECT public.invitation_accepter(
      ${code},
      ${params.utilisateurId}::uuid,
      ${params.email},
      ${params.telephone},
      ${params.identiteVerifiee}
    ) AS resultat
  `;
  const resultat = rows[0]?.resultat;
  if (!resultat) {
    throw new Error("invitation_accepter n'a rien retourné — anomalie DB.");
  }
  return resultat;
}
