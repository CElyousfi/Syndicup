/** POST /v1/taches/{id}/commentaires — commentaire (quiconque voit la tâche) ; le syndic / l'assigné(e) est notifié. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../../lib/taches/http";
type P = { params: Promise<{ id: string }> };
import { tacheCommentaireSchema } from "../../../../../lib/taches/schemas";
import { commenterTache } from "../../../../../lib/taches/taches";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = tacheCommentaireSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await commenterTache(ctx, id, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
