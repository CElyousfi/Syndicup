/** GET /v1/parkings/visiteurs/aujourdhui — gardien / syndic : places visiteurs occupées (visites, séjours LCD), dépassements, places libres. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../../lib/parkings/http";
import { visiteursAujourdhui } from "../../../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try { return ok(await visiteursAujourdhui(await tenantFromRequest(req))); }
  catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
