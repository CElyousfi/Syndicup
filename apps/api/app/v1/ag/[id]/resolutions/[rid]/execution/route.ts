/** GET /v1/ag/{id}/resolutions/{rid}/execution — suivi d'exécution d'une résolution (lecture par tout membre voyant l'AG : titre, statut, dates de la tâche liée). */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok } from "../../../../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../../../../lib/taches/http";
type P = { params: Promise<{ id: string; rid: string }> };
import { executionResolution } from "../../../../../../../lib/taches/taches";
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, rid } = await params;
    return ok(await executionResolution(ctx, id, rid));
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
