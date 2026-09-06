/** POST /v1/personnel/{id}/fiches-paie/{fid}/valider — recalcul avec les paramètres (422 sinon), dépense PERSONNEL créée + soumise, PDF déposé. Idempotency-Key. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../../../lib/personnel/http";
import { validerFichePaie } from "../../../../../../../lib/personnel/rh";
async function handlePOST(req: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  try { const ctx = await tenantFromRequest(req); const { id, fid } = await params; return ok(await validerFichePaie(ctx, id, fid, readIdempotencyKey(req))); }
  catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void failZod;
export const POST = withApiHandler(handlePOST);
