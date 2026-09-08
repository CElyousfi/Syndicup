/** GET /v1/coproprietes/{id}/mandat — mandat de cabinet proposé / actif sur la copropriété courante (Paramètres → Cabinet) : fiche publique du cabinet, gestionnaire, `peutConfirmer`. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurCabinet } from "../../../../../lib/cabinet/http";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { mandatDeLaCopropriete } from "../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    await params;
    return ok(await mandatDeLaCopropriete(ctx));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
