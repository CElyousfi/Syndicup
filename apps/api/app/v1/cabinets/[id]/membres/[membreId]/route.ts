/** PATCH /v1/cabinets/{id}/membres/{membreId} — rôle / retrait (actif=false) : les rôles de copropriété posés par le cabinet sont révoqués dans la même transaction. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../../lib/cabinet/http";
import { membreUpdateSchema } from "../../../../../../lib/cabinet/schemas";
import { modifierMembre } from "../../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string; membreId: string }> };
async function handlePATCH(req: Request, { params }: P) {
  try {
    const { id, membreId } = await params;
    const parsed = membreUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierMembre(await acteurFromRequest(req), id, membreId, parsed.data));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
