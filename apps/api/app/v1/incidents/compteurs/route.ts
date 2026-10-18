/**
 * GET /v1/incidents/compteurs — nombre d'incidents par statut + SLA dépassés (cartes de synthèse
 * de l'écran Incidents), sur tout le périmètre visible de l'appelant (RLS).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { compteursIncidents, PermissionRefuseeError } from "../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await compteursIncidents(ctx));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
