/** PATCH/DELETE /v1/vehicules/{id} — modification ; suppression = désactivation (historique conservé). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { vehiculeUpdateSchema } from "../../../../lib/parkings/schemas";
import { modifierVehicule, supprimerVehicule } from "../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = vehiculeUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierVehicule(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
async function handleDELETE(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await supprimerVehicule(ctx, id)); }
  catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
