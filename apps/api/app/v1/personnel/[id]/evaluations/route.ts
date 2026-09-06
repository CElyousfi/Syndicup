/** GET/POST /v1/personnel/{id}/evaluations — évaluations 1–5 (syndic, conseil) ; jamais visibles des résidents ni de l'employé. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { evaluer, listerEvaluations } from "../../../../../lib/personnel/rh";
import { evaluationCreateSchema } from "../../../../../lib/personnel/schemas";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await listerEvaluations(ctx, id)); }
  catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = evaluationCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await evaluer(ctx, id, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
