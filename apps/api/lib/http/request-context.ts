/**
 * Résolution du contexte tenant depuis la requête HTTP :
 *   Authorization: Bearer <jwt Supabase>  +  header X-Copropriete-Id (si plusieurs rôles).
 * Le copropriete_id demandé n'est JAMAIS cru sur parole : il doit figurer dans les claims du
 * JWT vérifié (lib/tenant/jwt.ts — Master Spec Partie 4.4).
 */
import {
  resolveTenantContext,
  verifyJwt,
  UnauthenticatedError,
  ForbiddenTenantError,
} from "../tenant/jwt";
import type { TenantContext } from "../tenant/context";
import { fail } from "./respond";

export { UnauthenticatedError, ForbiddenTenantError };

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

export async function tenantFromRequest(req: Request): Promise<TenantContext> {
  const token = bearerToken(req);
  if (!token) throw new UnauthenticatedError("Header Authorization: Bearer manquant.");
  const requested = req.headers.get("x-copropriete-id") ?? undefined;
  return resolveTenantContext(token, requested);
}


/**
 * Identité minimale pour les endpoints pré-tenant (ex. /auth/invite/accept : l'utilisateur est
 * authentifié Supabase mais n'a pas encore de rôle). Vérifie la signature via resolveTenant…
 * impossible ici (pas de rôle) → on vérifie signature + extrait sub/claims de vérification.
 */
export async function identiteFromRequest(
  req: Request
): Promise<{ utilisateurId: string; email: string | null; telephone: string | null; verifie: boolean }> {
  const token = bearerToken(req);
  if (!token) throw new UnauthenticatedError("Header Authorization: Bearer manquant.");
  const payload = await verifyJwt(token);
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) throw new UnauthenticatedError("JWT sans sub.");
  const email = typeof payload.email === "string" && payload.email ? payload.email : null;
  const phone = typeof payload.phone === "string" && payload.phone ? payload.phone : null;
  // NB : Supabase ne renseigne PAS user_metadata.phone_verified/email_verified sur son propre
  // flux OTP — ne jamais se fier à ces champs (testé en local : restent à false après un OTP
  // réussi). Un JWT de session valide n'est émis qu'après OTP correct ou mot de passe + email
  // confirmé (GoTrue, Partie 4.3) : la vérification est donc garantie par la seule présence
  // d'une session valide à ce stade, pas par un champ de metadata.
  const verifie = true;
  return { utilisateurId: sub, email, telephone: phone, verifie };
}

/** Mappe les erreurs d'auth en réponses HTTP normalisées (Partie 3.1). */
export function mapAuthError(e: unknown): Response | null {
  if (e instanceof UnauthenticatedError) return fail("UNAUTHENTICATED", e.message);
  if (e instanceof ForbiddenTenantError) return fail("FORBIDDEN", e.message);
  return null;
}
