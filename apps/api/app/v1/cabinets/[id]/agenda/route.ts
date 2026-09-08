/** GET /v1/cabinets/{id}/agenda — calendrier fusionné (AG, échéances de contrats, tâches, paie, fins de mandat) sur les copropriétés visibles ; `?jours=60`. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { ok } from "../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../lib/cabinet/http";
import { agenda } from "../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const { id } = await params;
    const jours = Math.min(Math.max(Number(new URL(req.url).searchParams.get("jours")) || 60, 7), 180);
    return ok(await agenda(await acteurFromRequest(req), id, jours));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
