/** GET/POST /v1/personnel/conges — toutes les demandes (syndic, conseil) ou les miennes (employé) ; POST = ma demande (Idempotency-Key). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../lib/personnel/http";
import { demanderConge, listerConges } from "../../../../lib/personnel/rh";
import { congeCreateSchema, congesFiltresSchema } from "../../../../lib/personnel/schemas";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = congesFiltresSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerConges(ctx, null, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = congeCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await demanderConge(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
