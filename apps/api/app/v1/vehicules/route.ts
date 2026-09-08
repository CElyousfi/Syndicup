/** GET/POST /v1/vehicules — véhicules déclarés (résident : ses lots via RLS ; syndic : tous) ; plaque normalisée, unique par copropriété (409). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurParkings } from "../../../lib/parkings/http";
import { vehiculeCreateSchema, vehiculesFiltresSchema } from "../../../lib/parkings/schemas";
import { creerVehicule, listerVehicules } from "../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = vehiculesFiltresSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerVehicules(ctx, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = vehiculeCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerVehicule(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
