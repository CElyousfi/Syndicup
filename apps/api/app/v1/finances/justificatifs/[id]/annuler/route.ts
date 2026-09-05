/** POST /v1/finances/justificatifs/:id/annuler — déclarant (ou syndic), EN_ATTENTE seulement. Probant : Idempotency-Key obligatoire. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok } from "../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { annulerJustificatif } from "../../../../../../lib/justificatifs/justificatifs";

import { mapErreurJustificatifs } from "../../../../../../lib/justificatifs/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await annulerJustificatif(ctx, id, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
