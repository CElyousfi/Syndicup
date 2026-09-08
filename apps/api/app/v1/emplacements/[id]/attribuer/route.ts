/** POST /v1/emplacements/{id}/attribuer — attribution (AG / rotation / location interne / temporaire) ; chevauchement → 409 ; Idempotency-Key. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../../lib/parkings/http";
import { attribuerSchema } from "../../../../../lib/parkings/schemas";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { attribuerEmplacement } from "../../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = attribuerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await attribuerEmplacement(ctx, id, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
