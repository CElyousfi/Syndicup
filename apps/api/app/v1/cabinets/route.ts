/** GET/POST /v1/cabinets — mes cabinets (SUPER_ADMIN : tous) ; création par l'opérateur plateforme (l'admin désigné devient CABINET_ADMIN). */
import { withApiHandler } from "../../../lib/http/handler";
import { ok, failZod } from "../../../lib/http/respond";
import { acteurFromRequest, mapErreurCabinet } from "../../../lib/cabinet/http";
import { cabinetCreateSchema } from "../../../lib/cabinet/schemas";
import { creerCabinet, listerCabinets } from "../../../lib/cabinet/cabinet";
async function handleGET(req: Request) {
  try {
    return ok(await listerCabinets(await acteurFromRequest(req)));
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const a = await acteurFromRequest(req);
    const parsed = cabinetCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerCabinet(a, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCabinet(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
