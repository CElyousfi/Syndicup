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
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import type { Role } from "../auth/permissions";
import { assertValidTenantContext, type TenantContext } from "./context";

export class UnauthenticatedError extends Error {}
export class ForbiddenTenantError extends Error {}

export interface RoleClaim {
  copropriete_id: string;
  role: Role;
}

/**
 * Extrait les claims de rôles d'un JWT vérifié SANS résoudre un tenant unique — pour les
 * endpoints multi-copropriétés (ex. GET /coproprietes : lister celles où l'appelant a un rôle).
 * Le copropriete_id de chaque claim vient du JWT vérifié, jamais du client.
 */
export async function resolveRoleClaims(
  token: string
): Promise<{ utilisateurId: string; roles: RoleClaim[] }> {
  const payload = await verifyJwt(token);
  const utilisateurId = typeof payload.sub === "string" ? payload.sub : "";
  const roles = Array.isArray(payload.roles) ? (payload.roles as RoleClaim[]) : [];
  if (!utilisateurId || roles.length === 0) {
    throw new UnauthenticatedError("JWT sans sub ou sans rôle.");
  }
  return { utilisateurId, roles };
}

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

// Mémoïsé au niveau module — createRemoteJWKSet gère lui-même le cache/refresh des clés.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Vérifie la signature d'un JWT Supabase et retourne ses claims.
 *
 * Deux modes de signature coexistent selon la configuration du projet Supabase :
 *  - clé asymétrique (ES256, projets récents / défaut CLI) → vérifiée via JWKS
 *    (`/auth/v1/.well-known/jwks.json`) — c'est le mode réel utilisé par Supabase Auth local
 *    et en production.
 *  - secret partagé HS256 (legacy, ou jetons synthétiques des tests d'intégration RLS qui ne
 *    passent pas par un vrai flux GoTrue) → vérifié avec JWT_SECRET.
 * On tente HS256 d'abord (rapide, pas d'appel réseau) puis JWKS en repli — jamais l'inverse ne
 * doit être supposé silencieusement, d'où l'échec explicite si aucun des deux n'est configurable.
 */
export async function verifyJwt(token: string): Promise<JWTPayload> {
  const secret = getJwtSecret();
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, secret);
      return payload;
    } catch {
      // repli JWKS ci-dessous
    }
  }
  const remoteJwks = getJwks();
  if (!remoteJwks) {
    throw new UnauthenticatedError("JWT invalide ou expiré.");
  }
  try {
    const { payload } = await jwtVerify(token, remoteJwks);
    return payload;
  } catch {
    throw new UnauthenticatedError("JWT invalide ou expiré.");
  }
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
  const payload = await verifyJwt(token);

  const utilisateurId = typeof payload.sub === "string" ? payload.sub : "";
  const roles = Array.isArray(payload.roles) ? (payload.roles as RoleClaim[]) : [];

  if (!utilisateurId || roles.length === 0) {
    throw new UnauthenticatedError("JWT sans sub ou sans rôle.");
  }

  const superAdmin = roles.find((r) => r.role === "SUPER_ADMIN");
  if (superAdmin) {
    // SUPER_ADMIN : copropriété demandée si fournie, sinon sa copropriété d'ancrage —
    // un opérateur fraîchement connecté (aucun cookie de sélection encore posé) doit
    // pouvoir lire son profil et atteindre la console sans étape supplémentaire.
    const ctx: TenantContext = {
      utilisateurId,
      coproprieteId: requestedCoproprieteId ?? superAdmin.copropriete_id,
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
    // Sans copropriété demandée : n'échouer QUE si l'ambiguïté est réelle. Plusieurs
    // rôles dans la MÊME copropriété (ex. syndic également membre du conseil) ne sont
    // pas une ambiguïté de tenant — on retient le rôle le plus privilégié.
    const coprosDistinctes = [...new Set(roles.map((r) => r.copropriete_id))];
    if (coprosDistinctes.length > 1) {
      throw new ForbiddenTenantError(
        "Plusieurs copropriétés dans le JWT — préciser la copropriété cible."
      );
    }
    const PRIORITE: RoleClaim["role"][] = [
      "SYNDIC",
      "CONSEIL_SYNDICAL",
      "PROPRIETAIRE",
      "INDIVISAIRE",
      "PERSONNE_MORALE_REPRESENTANT",
      "LOCATAIRE",
      "GARDIEN",
      "PRESTATAIRE",
    ];
    claim = [...roles].sort(
      (a, b) => PRIORITE.indexOf(a.role) - PRIORITE.indexOf(b.role)
    )[0];
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
