/** PATCH /v1/personnel/{id}/fiches-paie/{fid} — recalcul d'un brouillon (brut, primes, retenues, absences). */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../../lib/personnel/http";
import { modifierFichePaie } from "../../../../../../lib/personnel/rh";
import { fichePaieUpdateSchema } from "../../../../../../lib/personnel/schemas";
async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req); const { id, fid } = await params;
    const parsed = fichePaieUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierFichePaie(ctx, id, fid, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const PATCH = withApiHandler(handlePATCH);
