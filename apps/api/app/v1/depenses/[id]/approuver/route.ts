/** POST /v1/depenses/:id/approuver — A_APPROUVER → APPROUVEE (conseil au-dessus du seuil, syndic en dessous). Probant : Idempotency-Key obligatoire. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { approuverDepense } from "../../../../../lib/depenses/depenses";
import { mapErreurDepenses } from "../../../../../lib/depenses/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await approuverDepense(ctx, id, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
