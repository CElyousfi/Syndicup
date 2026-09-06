/** GET/POST /v1/personnel/{id}/presences — présences (from/to) ; POST = saisie / correction en masse par date (syndic) ou pointage propre (employé). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { listerPresences, saisirPresences } from "../../../../../lib/personnel/rh";
import { presencesQuerySchema, presencesUpsertSchema } from "../../../../../lib/personnel/schemas";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = presencesQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerPresences(ctx, id, parsed.data.from, parsed.data.to));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = presencesUpsertSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await saisirPresences(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
