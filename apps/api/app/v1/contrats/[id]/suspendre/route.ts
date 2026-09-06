/** POST /v1/contrats/{id}/suspendre — transition de cycle de vie (syndic, Idempotency-Key). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { suspendreContrat } from "../../../../../lib/contrats/contrats";
import { contratSuspendreSchema } from "../../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../../lib/contrats/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = contratSuspendreSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await suspendreContrat(ctx, id, parsed.data, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
