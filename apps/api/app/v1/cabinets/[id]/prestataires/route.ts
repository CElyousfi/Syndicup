/** GET/POST /v1/cabinets/{id}/prestataires — annuaire de prestataires du cabinet (modèles). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../lib/cabinet/http";
import { prestataireModeleSchema } from "../../../../../lib/cabinet/schemas";
import { creerPrestataireModele, listerPrestatairesModeles } from "../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const { id } = await params; return ok(await listerPrestatairesModeles(await acteurFromRequest(req), id));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request, { params }: P) {
  try {
    const { id } = await params;
    const parsed = prestataireModeleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerPrestataireModele(await acteurFromRequest(req), id, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
