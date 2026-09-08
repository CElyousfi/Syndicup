/** GET /v1/vehicules/recherche?immatriculation= — gardien / syndic, AUDITÉE (VEHICULE_RECHERCHE) : plaque → lot. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { rechercheSchema } from "../../../../lib/parkings/schemas";
import { rechercherVehicule } from "../../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = rechercheSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await rechercherVehicule(ctx, parsed.data.immatriculation));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
