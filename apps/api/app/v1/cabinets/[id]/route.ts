/** GET/PATCH /v1/cabinets/{id} — fiche (membres) ; modification par l'administrateur du cabinet (suspension : opérateur). */
import { withApiHandler } from "../../../../lib/http/handler";
import { ok, failZod } from "../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../lib/cabinet/http";
import { cabinetUpdateSchema } from "../../../../lib/cabinet/schemas";
import { modifierCabinet, obtenirCabinet } from "../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const { id } = await params; return ok(await obtenirCabinet(await acteurFromRequest(req), id));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const { id } = await params;
    const parsed = cabinetUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierCabinet(await acteurFromRequest(req), id, parsed.data));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
