/**
 * Service invitations — Master Spec Partie 5.1 (canaux/expirations), 5.3 (attribution de rôle),
 * 5.5 (edge cases). Émission/liste/régénération : tenant-scopé via withTenant (syndic).
 * Acceptation : fonction SQL SECURITY DEFINER `invitation_accepter` (l'invité n'a pas encore de
 * contexte tenant) — voir migration m2.
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { can } from "./permissions";
import { withTenant } from "../tenant/db";
import { envoyerNotification } from "../notifications/notifications";
import type { TenantContext } from "../tenant/context";
import type { InvitationCreateInput, InviteInscriptionInput } from "./schemas";
import type { SessionTokens, SupabaseAuthPort, SupabaseAdminPort } from "./supabase";
import { ecrireAuditLog } from "../audit/audit";

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

/**
 * Le rôle SYNDIC n'est attribuable QUE par l'opérateur plateforme (SUPER_ADMIN) : un syndic
 * ne peut pas inviter un autre syndic — ni en créer, ni en régénérer l'invitation. C'est la
 * frontière de responsabilité du produit (super admin = crée la copropriété et son syndic ;
 * syndic = tout le reste), vérifiée ici quel que soit ce que l'interface propose.
 */
export function assertPeutViserLeRole(ctx: TenantContext, roleCible: string) {
  if (roleCible === "SYNDIC" && ctx.role !== "SUPER_ADMIN") {
    throw new PermissionRefuseeError(
      "Seul le super administrateur peut inviter un syndic (frontière de responsabilité)."
    );
  }
}

export async function creerInvitation(ctx: TenantContext, input: InvitationCreateInput) {
  if (can("onboarding.inviter", ctx.role) !== true) {
    throw new PermissionRefuseeError("Seul le syndic peut émettre une invitation (Partie 5.3).");
  }
  assertPeutViserLeRole(ctx, input.role_cible);
  return withTenant(ctx, async (db) => {
    const invitation = await db.invitation.create({
      data: {
        coproprieteId: ctx.coproprieteId,
        lotId: input.lot_id ?? null,
        roleCible: input.role_cible,
        emetteurId: ctx.utilisateurId,
        canal: input.canal,
        code: genererCode(),
        expireLe: expiration(input.canal),
      },
    });
    // Probant (Partie 5.3 : l'invitation lie compte↔lot↔rôle) — jamais le code dans l'audit.
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "INVITATION_CREEE",
      entite: "invitation",
      entiteId: invitation.id,
      apres: { role_cible: invitation.roleCible, lot_id: invitation.lotId, canal: invitation.canal },
    });
    return invitation;
  });
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
    assertPeutViserLeRole(ctx, ancienne.roleCible);
    await db.invitation.update({
      where: { id: ancienne.id },
      data: { statut: "REGENEREE" },
    });
    const nouvelle = await db.invitation.create({
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
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "INVITATION_REGENEREE",
      entite: "invitation",
      entiteId: nouvelle.id,
      avant: { invitation_precedente: ancienne.id },
      apres: { role_cible: nouvelle.roleCible, lot_id: nouvelle.lotId },
    });
    return nouvelle;
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

/** Empreinte du jeton d'ouverture (jamais le jeton en clair en base). */
export function hacherJeton(jeton: string | null | undefined): string | null {
  const j = (jeton ?? "").trim();
  if (j.length < 16 || j.length > 128) return null;
  return createHash("sha256").update(j).digest("hex");
}

export interface ApercuInvitation {
  /** OUVERTE : déjà ouverte sur un autre appareil — le code est consommé (usage unique). */
  statut: "EN_ATTENTE" | "ACCEPTEE" | "EXPIREE" | "REGENEREE" | "INVALIDE" | "OUVERTE";
  copropriete_nom?: string;
  ville?: string;
  role_cible?: string;
  expire_le?: string;
}

/**
 * GET /auth/invite/:code — aperçu public (résidence, rôle, expiration, état), sans PII.
 * Usage unique (M17) : le premier appareil qui ouvre le code y est lié par son jeton ; un
 * autre appareil obtient OUVERTE et ne peut ni s'inscrire ni accepter.
 */
export async function apercuInvitation(code: string, jeton?: string | null): Promise<ApercuInvitation> {
  const rows = await rpcClient.$queryRaw<{ apercu: ApercuInvitation }[]>`
    SELECT public.invitation_apercu(${code}, ${hacherJeton(jeton)}) AS apercu
  `;
  return rows[0]?.apercu ?? { statut: "INVALIDE" };
}

export type ResultatInscription =
  | { statut: "OK"; session: SessionTokens; copropriete_id: string; role: string; statut_compte: string }
  | { statut: "EMAIL_DEJA_INSCRIT" }
  | { statut: Exclude<ResultatAcceptation["statut"], "OK"> };

/**
 * POST /auth/invite/inscription — le geste unique de l'invité : scan/code → compte + accès.
 *  1. l'invitation doit être EN_ATTENTE et non expirée AVANT toute création (pas de compte
 *     orphelin pour un code mort) ;
 *  2. création du compte GoTrue (email confirmé : le code à usage unique vaut preuve) ;
 *  3. rattachement atomique par invitation_accepter (rôle + copropriété + lot) ;
 *     en cas d'échec → suppression compensatoire du compte GoTrue ;
 *  4. informations personnelles sur le profil, puis session ouverte (password grant).
 */
export async function inscrireParInvitation(
  input: InviteInscriptionInput,
  ports: { auth: SupabaseAuthPort; admin: SupabaseAdminPort }
): Promise<ResultatInscription> {
  const apercu = await apercuInvitation(input.code, input.jeton);
  if (apercu.statut !== "EN_ATTENTE") {
    return {
      statut:
        apercu.statut === "INVALIDE"
          ? "INVALIDE"
          : apercu.statut === "ACCEPTEE" || apercu.statut === "OUVERTE"
            ? "DEJA_UTILISEE"
            : "EXPIREE",
    };
  }

  const email = input.email.trim().toLowerCase();
  const compte = await ports.admin.creerCompteEmail(email, input.mot_de_passe);
  if (!compte.userId) {
    if (compte.dejaInscrit) return { statut: "EMAIL_DEJA_INSCRIT" };
    throw new Error(`Création du compte impossible : ${compte.error ?? "inconnu"}`);
  }

  const resultat = await accepterInvitation(
    { utilisateurId: compte.userId, email, telephone: null, identiteVerifiee: true },
    input.code,
    input.jeton
  );
  if (resultat.statut !== "OK") {
    await ports.admin.supprimerCompte(compte.userId); // compensation : jamais de compte orphelin
    return { statut: resultat.statut };
  }

  // Informations de l'invité — dans le tenant qu'il vient de rejoindre.
  const ctxNouveau: TenantContext = {
    utilisateurId: compte.userId,
    coproprieteId: resultat.copropriete_id,
    role: resultat.role as TenantContext["role"],
  };
  await withTenant(ctxNouveau, (db) =>
    db.utilisateur.update({
      where: { id: compte.userId! },
      data: { prenom: input.prenom, nom: input.nom, languePreferee: input.langue_preferee },
    })
  );

  const { session, error } = await ports.auth.loginEmail(email, input.mot_de_passe);
  if (error || !session) {
    throw new Error(`Compte créé et rattaché mais ouverture de session impossible : ${error}`);
  }
  return {
    statut: "OK",
    session,
    copropriete_id: resultat.copropriete_id,
    role: resultat.role,
    statut_compte: resultat.statut_compte,
  };
}

export async function accepterInvitation(params: {
  utilisateurId: string;
  email: string | null;
  telephone: string | null;
  identiteVerifiee: boolean;
}, code: string, jeton?: string | null): Promise<ResultatAcceptation> {
  const rows = await rpcClient.$queryRaw<{ resultat: ResultatAcceptation }[]>`
    SELECT public.invitation_accepter(
      ${code},
      ${params.utilisateurId}::uuid,
      ${params.email},
      ${params.telephone},
      ${params.identiteVerifiee},
      ${hacherJeton(jeton)}
    ) AS resultat
  `;
  const resultat = rows[0]?.resultat;
  if (!resultat) {
    throw new Error("invitation_accepter n'a rien retourné — anomalie DB.");
  }
  if (resultat.statut === "OK") {
    // Probant : le rattachement compte↔rôle↔lot vient d'être créé. Le contexte tenant n'existe
    // qu'à partir du résultat de la RPC — audit dans la copropriété rejointe.
    const ctxNouveau: TenantContext = {
      utilisateurId: params.utilisateurId,
      coproprieteId: resultat.copropriete_id,
      role: resultat.role as TenantContext["role"],
    };
    await withTenant(ctxNouveau, async (db) => {
      await ecrireAuditLog(db, {
        coproprieteId: resultat.copropriete_id,
        acteurId: params.utilisateurId,
        action: "INVITATION_ACCEPTEE",
        entite: "utilisateur",
        entiteId: params.utilisateurId,
        apres: { role: resultat.role, lot_id: resultat.lot_id },
      });
      // Le syndic voit arriver le nouveau membre à l'instant (toast + boîte de réception).
      const syndics = await db.roleUtilisateur.findMany({
        where: { coproprieteId: resultat.copropriete_id, actif: true, role: "SYNDIC" },
        select: { utilisateurId: true },
      });
      await Promise.all(
        syndics
          .filter((s) => s.utilisateurId !== params.utilisateurId)
          .map((s) =>
            envoyerNotification(db, {
              coproprieteId: resultat.copropriete_id,
              utilisateurId: s.utilisateurId,
              templateCode: "INVITATION_ACCEPTEE",
              canal: "PUSH",
              contenuJson: { role: resultat.role, lot_id: resultat.lot_id, utilisateur_id: params.utilisateurId },
            })
          )
      );
    });
  }
  return resultat;
}

/**
 * DELETE /invitations/:id — annulation d'une invitation EN_ATTENTE (syndic ; super admin
 * pour une invitation SYNDIC). L'invitation passe à EXPIREE : le code cesse de fonctionner
 * immédiatement, la trace reste (jamais de suppression physique d'une invitation).
 */
export async function annulerInvitation(ctx: TenantContext, invitationId: string) {
  if (can("onboarding.inviter", ctx.role) !== true) {
    throw new PermissionRefuseeError("Réservé au syndic.");
  }
  return withTenant(ctx, async (db) => {
    const invitation = await db.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.coproprieteId !== ctx.coproprieteId) {
      throw new InvitationIntrouvableError("Invitation introuvable.");
    }
    assertPeutViserLeRole(ctx, invitation.roleCible);
    if (invitation.statut !== "EN_ATTENTE") {
      throw new InvitationDejaAccepteeError("Seule une invitation en attente peut être annulée.");
    }
    const maj = await db.invitation.update({
      where: { id: invitationId },
      data: { statut: "EXPIREE" },
    });
    await ecrireAuditLog(db, {
      coproprieteId: ctx.coproprieteId,
      acteurId: ctx.utilisateurId,
      action: "INVITATION_ANNULEE",
      entite: "invitation",
      entiteId: invitationId,
      apres: { role_cible: invitation.roleCible, statut: "EXPIREE" },
    });
    return maj;
  });
}
