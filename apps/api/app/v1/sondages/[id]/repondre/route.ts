/** POST /v1/sondages/{id}/repondre — réponse unique de l'appelant (Idempotency-Key ; 409 si déjà répondu). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { sondageRepondreSchema } from "../../../../../lib/communication/schemas";
import { repondreSondage } from "../../../../../lib/communication/sondages";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = sondageRepondreSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await repondreSondage(ctx, id, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
