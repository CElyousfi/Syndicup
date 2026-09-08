/** GET /v1/emplacements/plan — grille par niveau avec occupation (attributions courantes, places visiteurs occupées). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { planEmplacements } from "../../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try { return ok(await planEmplacements(await tenantFromRequest(req))); }
  catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
