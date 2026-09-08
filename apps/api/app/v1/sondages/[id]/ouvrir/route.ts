/** POST /v1/sondages/{id}/ouvrir — ouverture + notification de l'audience ; Idempotency-Key. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { ouvrirSondage } from "../../../../../lib/communication/sondages";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await ouvrirSondage(ctx, id, readIdempotencyKey(req)));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
