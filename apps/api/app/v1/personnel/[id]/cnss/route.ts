/** GET /v1/personnel/{id}/cnss — n° CNSS complet (syndic seul, audité CNSS_CONSULTE). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { lireCnss } from "../../../../../lib/personnel/rh";
async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await lireCnss(ctx, id)); }
  catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void failZod; void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
