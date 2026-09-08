/** PATCH /v1/cabinets/{id}/coproprietes/{coproId} — mandat (gestionnaire principal, fin, honoraires) ; `coproId` = id du mandat. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../../lib/cabinet/http";
import { mandatUpdateSchema } from "../../../../../../lib/cabinet/schemas";
import { modifierMandat } from "../../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string; coproId: string }> };
async function handlePATCH(req: Request, { params }: P) {
  try {
    const { id, coproId } = await params;
    const parsed = mandatUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierMandat(await acteurFromRequest(req), id, coproId, parsed.data));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
