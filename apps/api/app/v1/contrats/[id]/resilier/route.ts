/** POST /v1/contrats/{id}/resilier — transition de cycle de vie (syndic, Idempotency-Key). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { resilierContrat } from "../../../../../lib/contrats/contrats";
import { contratResilierSchema } from "../../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../../lib/contrats/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = contratResilierSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await resilierContrat(ctx, id, parsed.data, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
