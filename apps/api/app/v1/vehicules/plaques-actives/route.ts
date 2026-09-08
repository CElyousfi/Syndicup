/** GET /v1/vehicules/plaques-actives — cache hors-ligne du gardien (plaque → lot). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { plaquesActives } from "../../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try { return ok(await plaquesActives(await tenantFromRequest(req))); }
  catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
