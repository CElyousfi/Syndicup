/**
 * GET /v1/users/me/export — export des données personnelles (droit d'accès CNDP, Loi 09-08,
 * Master Spec Partie 10.1 — M13). Multi-copropriétés : agrégé depuis les claims JWT vérifiés.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { exporterMesDonnees, UtilisateurIntrouvableError } from "../../../../../lib/users/users";
import { resolveRoleClaims, UnauthenticatedError } from "../../../../../lib/tenant/jwt";
import { bearerToken, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) throw new UnauthenticatedError("Header Authorization: Bearer manquant.");
    const { utilisateurId, roles } = await resolveRoleClaims(token);
    return ok(await exporterMesDonnees(utilisateurId, roles));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof UtilisateurIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
