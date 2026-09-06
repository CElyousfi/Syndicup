/** POST /v1/personnel/me/presence — pointage de l'employé (aujourd'hui par défaut ; mobile hors-ligne ; Idempotency-Key). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { pointer } from "../../../../../lib/personnel/rh";
import { presenceSelfSchema } from "../../../../../lib/personnel/schemas";
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = presenceSelfSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await pointer(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
