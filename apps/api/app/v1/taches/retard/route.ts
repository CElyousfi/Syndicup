/** GET /v1/taches/retard — tâches ouvertes dont l'échéance est passée. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../lib/taches/http";
import { tachesEnRetard } from "../../../../lib/taches/taches";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await tachesEnRetard(ctx));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
