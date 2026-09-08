/** GET/PATCH /v1/taches/{id} — détail (pièces jointes signées, commentaires, journal) ; modification (syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../lib/taches/http";
type P = { params: Promise<{ id: string }> };
import { tacheUpdateSchema } from "../../../../lib/taches/schemas";
import { modifierTache, obtenirTache } from "../../../../lib/taches/taches";
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirTache(ctx, id));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = tacheUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierTache(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
