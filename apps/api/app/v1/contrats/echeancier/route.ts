/** GET /v1/contrats/echeancier?from&to — flux calendrier des échéances (syndic / conseil). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { echeancier } from "../../../../lib/contrats/contrats";
import { echeancierQuerySchema } from "../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../lib/contrats/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = echeancierQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await echeancier(ctx, parsed.data.from, parsed.data.to, { type: parsed.data.type, statut: parsed.data.statut }));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
