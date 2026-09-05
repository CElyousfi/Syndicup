/** GET /v1/prestataires/:id/rib — RIB complet du fournisseur (syndic seul, lecture auditée PRESTATAIRE_RIB_CONSULTE). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { lireRibPrestataire } from "../../../../../lib/prestataires/prestataires";
import { mapErreurDepenses } from "../../../../../lib/depenses/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await lireRibPrestataire(ctx, id));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
