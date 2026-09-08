/** GET/PATCH/DELETE /v1/sondages/{id} — détail (ma réponse, résultats agrégés si visibles), modification et suppression d'un brouillon. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { sondageUpdateSchema } from "../../../../lib/communication/schemas";
import { modifierSondage, obtenirSondage, supprimerSondage } from "../../../../lib/communication/sondages";
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirSondage(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = sondageUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierSondage(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handleDELETE(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await supprimerSondage(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
