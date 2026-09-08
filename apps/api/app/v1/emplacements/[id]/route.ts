/** GET/PATCH/DELETE /v1/emplacements/{id} — fiche (historique des attributions), modification (statut HORS_SERVICE si non attribué), suppression (sans historique). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { emplacementUpdateSchema } from "../../../../lib/parkings/schemas";
import { modifierEmplacement, obtenirEmplacement, supprimerEmplacement } from "../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await obtenirEmplacement(ctx, id)); }
  catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = emplacementUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierEmplacement(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
async function handleDELETE(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await supprimerEmplacement(ctx, id)); }
  catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
