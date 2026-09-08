/** POST /v1/taches/{id}/statut — transition (syndic ou assigné(e) ; annulation syndic seul) ; rejouable à l'identique (mobile hors-ligne). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../../lib/taches/http";
type P = { params: Promise<{ id: string }> };
import { tacheStatutSchema } from "../../../../../lib/taches/schemas";
import { changerStatutTache } from "../../../../../lib/taches/taches";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = tacheStatutSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await changerStatutTache(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
