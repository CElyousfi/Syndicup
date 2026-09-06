/** GET/POST /v1/personnel/{id}/conges — congés de l'employé ; POST = demande au nom de l'employé (syndic) ou pour soi (employé). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { demanderConge, listerConges } from "../../../../../lib/personnel/rh";
import { congeCreateSchema, congesFiltresSchema } from "../../../../../lib/personnel/schemas";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = congesFiltresSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerConges(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = congeCreateSchema.safeParse({ ...(await req.json().catch(() => ({}))), personnel_id: id });
    if (!parsed.success) return failZod(parsed.error);
    return ok(await demanderConge(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
