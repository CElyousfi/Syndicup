/** POST /v1/taches/{id}/assigner — assignation (syndic) à un syndic, membre du conseil ou membre du personnel. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../../lib/taches/http";
type P = { params: Promise<{ id: string }> };
import { tacheAssignerSchema } from "../../../../../lib/taches/schemas";
import { assignerTache } from "../../../../../lib/taches/taches";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = tacheAssignerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await assignerTache(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
