/** GET /v1/personnel/fiches-paie?periode=YYYY-MM — vue paie du mois de la copropriété (syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../lib/personnel/http";
import { listerFichesPaieCopropriete, periodeCourante } from "../../../../lib/personnel/rh";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const p = new URL(req.url).searchParams.get("periode");
    const periode = p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? p : periodeCourante();
    return ok(await listerFichesPaieCopropriete(ctx, periode));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void failZod; void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
