/** GET /v1/coproprietes/:id/comptes-bancaires/:index/rib — RIB complet (syndic seul, audité RIB_CONSULTE). */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../../lib/http/respond";
import { lireRibCompte } from "../../../../../../../lib/justificatifs/comptes-bancaires";
import { mapErreurJustificatifs } from "../../../../../../../lib/justificatifs/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, index } = await params;
    if (!/^\d{1,2}$/.test(index)) return fail("VALIDATION_ERROR", "Index de compte invalide.");
    return ok(await lireRibCompte(ctx, id, Number(index)));
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
