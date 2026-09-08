/** PATCH /v1/taches/{id}/checklist — remplacement de la liste ou bascule d'un élément (syndic, assigné(e)). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../../lib/taches/http";
type P = { params: Promise<{ id: string }> };
import { tacheChecklistSchema } from "../../../../../lib/taches/schemas";
import { mettreAJourChecklist } from "../../../../../lib/taches/taches";
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = tacheChecklistSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await mettreAJourChecklist(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
