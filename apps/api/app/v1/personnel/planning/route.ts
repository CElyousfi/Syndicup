/** GET /v1/personnel/planning?semaine=YYYY-MM-DD — semaine (lundi → dimanche) : horaires, congés approuvés, remplaçants, présences. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../lib/personnel/http";
import { planning } from "../../../../lib/personnel/rh";
import { planningQuerySchema } from "../../../../lib/personnel/schemas";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = planningQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await planning(ctx, parsed.data.semaine));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
