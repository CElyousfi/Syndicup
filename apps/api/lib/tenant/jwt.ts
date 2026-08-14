/**
 * Vérification du JWT Supabase et résolution du contexte tenant (Master Spec Partie 4.4).
 *
 * Structure attendue des claims :
 *   { sub: utilisateur_id, roles: [{ copropriete_id, role }], ... }
 *
 * Note de convention : le Master Spec Partie 4.4 illustre les rôles en minuscules
 * ("proprietaire") mais la convention enums du repo est SCREAMING_SNAKE_CASE (CLAUDE.md §3,
 * enum Postgres RoleType). Ce repo standardise les claims ET le contexte RLS en
 * SCREAMING_SNAKE_CASE — divergence de forme signalée, pas résolue silencieusement.
 */
import { jwtVerify } from "jose";
import type { Role } from "../auth/permissions";
import { assertValidTenantContext, type TenantContext } from "./context";

export class UnauthenticatedError extends Error {}
export class ForbiddenTenantError extends Error {}

interface RoleClaim {
  copropriete_id: string;
  role: Role;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET manquant ou trop court (>= 32 caractères requis).");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Vérifie le token et retourne le TenantContext pour la copropriété demandée.
 *
 * - `requestedCoproprieteId` absent : mono-copropriété attendue — si l'utilisateur a des rôles
 *   dans plusieurs copropriétés, l'appelant DOIT préciser laquelle (erreur explicite sinon).
 * - Le `copropriete_id` demandé doit figurer dans les claims du JWT — jamais accepté sur
 *   parole client (Master Spec Partie 4.4). Exception : SUPER_ADMIN (accès plateforme).
 */
export async function resolveTenantContext(
  token: string,
  requestedCoproprieteId?: string
): Promise<TenantContext> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, getJwtSecret()));
  } catch {
    throw new UnauthenticatedError("JWT invalide ou expiré.");
  }

  const utilisateurId = typeof payload.sub === "string" ? payload.sub : "";
  const roles = Array.isArray(payload.roles) ? (payload.roles as RoleClaim[]) : [];

  if (!utilisateurId || roles.length === 0) {
    throw new UnauthenticatedError("JWT sans sub ou sans rôle.");
  }

  const superAdmin = roles.find((r) => r.role === "SUPER_ADMIN");
  if (superAdmin && requestedCoproprieteId) {
    const ctx: TenantContext = {
      utilisateurId,
      coproprieteId: requestedCoproprieteId,
      role: "SUPER_ADMIN",
    };
    assertValidTenantContext(ctx);
    return ctx;
  }

  let claim: RoleClaim | undefined;
  if (requestedCoproprieteId) {
    claim = roles.find((r) => r.copropriete_id === requestedCoproprieteId);
    if (!claim) {
      throw new ForbiddenTenantError(
        "Aucun rôle dans la copropriété demandée — accès refusé."
      );
    }
  } else {
    if (roles.length > 1) {
      throw new ForbiddenTenantError(
        "Plusieurs copropriétés dans le JWT — préciser la copropriété cible."
      );
    }
    claim = roles[0];
  }

  if (!claim) {
    throw new UnauthenticatedError("JWT sans rôle exploitable.");
  }

  const ctx: TenantContext = {
    utilisateurId,
    coproprieteId: claim.copropriete_id,
    role: claim.role,
  };
  assertValidTenantContext(ctx);
  return ctx;
}
