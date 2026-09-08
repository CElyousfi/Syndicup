/** GET /v1/annonces/{id}/lectures — statistiques de lecture (syndic / conseil) : « lu par n / N » + lecteurs. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { lecturesAnnonce } from "../../../../../lib/communication/communication";
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await lecturesAnnonce(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
