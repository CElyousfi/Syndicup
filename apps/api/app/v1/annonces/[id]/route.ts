/** GET/PATCH/DELETE /v1/annonces/{id} — détail (pièces jointes signées, commentaires), modification, suppression d'un brouillon. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { annonceUpdateSchema } from "../../../../lib/communication/schemas";
import { modifierAnnonce, obtenirAnnonce, supprimerAnnonce } from "../../../../lib/communication/communication";
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirAnnonce(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = annonceUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierAnnonce(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handleDELETE(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await supprimerAnnonce(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
