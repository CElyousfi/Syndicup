/** GET /v1/emplacements/attributions — attributions visibles (résident : ses lots via RLS ; syndic : toutes, filtre `lot_id`). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { mesAttributions } from "../../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const lotId = new URL(req.url).searchParams.get("lot_id") ?? undefined;
    return ok(await mesAttributions(ctx, lotId));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
