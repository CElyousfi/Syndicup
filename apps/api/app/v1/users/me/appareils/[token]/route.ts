/**
 * DELETE /v1/users/me/appareils/{token} — retire le jeton push de l'appareil (déconnexion).
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { retirerAppareil } from "../../../../../../lib/users/appareils";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../lib/http/respond";

async function handleDELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { token } = await params;
    const decoded = decodeURIComponent(token);
    if (decoded.length < 20) return fail("VALIDATION_ERROR", "Jeton d'appareil invalide.");
    const r = await retirerAppareil(ctx, decoded);
    if (!r.supprime) return fail("NOT_FOUND", "Appareil inconnu pour ce compte.");
    return ok(r);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export const DELETE = withApiHandler(handleDELETE);
