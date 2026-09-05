/** POST /v1/depenses/:id/rejeter — A_APPROUVER → REJETEE, motif obligatoire. Probant : Idempotency-Key obligatoire. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { rejeterDepense } from "../../../../../lib/depenses/depenses";
import { depenseRejeterSchema } from "../../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../../lib/depenses/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = depenseRejeterSchema.safeParse((await req.json().catch(() => null)) ?? {});
    if (!parsed.success) return failZod(parsed.error);
    return ok(await rejeterDepense(ctx, id, parsed.data, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
