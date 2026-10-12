/** DELETE /v1/users/me/appareils/activite/:id — l'utilisateur a fermé l'activité (ses propres inscriptions seulement) — M26. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { terminerActivite } from "../../../../../../../lib/notifications/activites";
import { tenantFromRequest, mapAuthError } from "../../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../../lib/http/respond";

async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const r = await terminerActivite(ctx, id);
    if (!r.supprime) return fail("NOT_FOUND", "Activité introuvable.");
    return ok(r);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export const DELETE = withApiHandler(handleDELETE);
