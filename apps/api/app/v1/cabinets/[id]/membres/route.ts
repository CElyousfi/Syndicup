/** GET/POST /v1/cabinets/{id}/membres — équipe du cabinet ; ajout d'un compte existant (id, téléphone ou e-mail) → accès réconciliés atomiquement. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { ok, failZod } from "../../../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../../../lib/cabinet/http";
import { membreCreateSchema } from "../../../../../lib/cabinet/schemas";
import { ajouterMembre, listerMembres } from "../../../../../lib/cabinet/cabinet";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const { id } = await params; return ok(await listerMembres(await acteurFromRequest(req), id));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request, { params }: P) {
  try {
    const { id } = await params;
    const parsed = membreCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await ajouterMembre(await acteurFromRequest(req), id, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
