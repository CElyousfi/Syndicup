/** GET /v1/cabinets/{id}/alertes — flux transverse : assurance absente, recouvrement sous le seuil, tâches en retard, justificatifs en attente > N jours, incidents urgents. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { ok } from "../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../lib/cabinet/http";
import { alertes } from "../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const { id } = await params; return ok(await alertes(await acteurFromRequest(req), id));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
