/** GET /v1/contrats/a-renouveler?jours=90 — contrats dont la fin approche + expirés récents. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { contratsARenouveler } from "../../../../lib/contrats/contrats";
import { aRenouvelerQuerySchema } from "../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../lib/contrats/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = aRenouvelerQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await contratsARenouveler(ctx, parsed.data.jours));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
