/** POST /v1/contrats/{id}/activer — transition de cycle de vie (syndic, Idempotency-Key). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { activerContrat } from "../../../../../lib/contrats/contrats";

import { mapErreurContrats } from "../../../../../lib/contrats/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await activerContrat(ctx, id, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
