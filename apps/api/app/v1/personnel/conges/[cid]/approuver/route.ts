/** POST /v1/personnel/conges/{cid}/approuver — décision du syndic (approuver / refuser, Idempotency-Key) ou annulation (employé pour sa demande, syndic). */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../../lib/personnel/http";
import { deciderConge, annulerConge } from "../../../../../../lib/personnel/rh";
import { congeDeciderSchema } from "../../../../../../lib/personnel/schemas";
async function handlePOST(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req); const { cid } = await params;
    const parsed = congeDeciderSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await deciderConge(ctx, cid, "APPROUVE", parsed.data, readIdempotencyKey(req)));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void annulerConge;
export const POST = withApiHandler(handlePOST);
