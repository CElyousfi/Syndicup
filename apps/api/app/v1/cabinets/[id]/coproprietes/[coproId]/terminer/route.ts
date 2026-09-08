/** POST /v1/cabinets/{id}/coproprietes/{coproId}/terminer — fin de mandat (admin du cabinet) : accès révoqués atomiquement ; `coproId` = id du mandat. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../../../lib/cabinet/http";
import { mandatTerminerSchema } from "../../../../../../../lib/cabinet/schemas";
import { terminerMandat } from "../../../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string; coproId: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const { id, coproId } = await params;
    const parsed = mandatTerminerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await terminerMandat(await acteurFromRequest(req), id, coproId, parsed.data));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
