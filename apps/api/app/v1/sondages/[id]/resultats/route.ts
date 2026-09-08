/** GET /v1/sondages/{id}/resultats — agrégats seulement (jamais un répondant), pondérés et non pondérés. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { resultatsSondage } from "../../../../../lib/communication/sondages";
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await resultatsSondage(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
