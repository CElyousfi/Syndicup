/** POST /v1/cabinets/{id}/coproprietes/{coproId}/confirmer — le SYNDIC en place (contexte copropriété X-Copropriete-Id) confirme : passation atomique (son rôle cédé, accès du cabinet posés) ; `coproId` = copropriété. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { ok } from "../../../../../../../lib/http/respond";
import { mapErreurCabinet } from "../../../../../../../lib/cabinet/http";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { confirmerMandat } from "../../../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string; coproId: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await confirmerMandat(ctx, id));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
