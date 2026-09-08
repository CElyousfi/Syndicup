/** GET /v1/taches/mes-taches — tâches assignées à l'appelant (gardien, conseil, syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../lib/taches/http";
import { mesTaches } from "../../../../lib/taches/taches";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await mesTaches(ctx));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
