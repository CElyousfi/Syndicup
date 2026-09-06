/** GET/POST /v1/personnel/{id}/fiches-paie — fiches de paie de l'employé (syndic ; l'employé lit les siennes) ; POST : brouillon calculé (syndic). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { creerFichePaie, listerFichesPaie } from "../../../../../lib/personnel/rh";
import { fichePaieCreateSchema, fichesPaieFiltresSchema } from "../../../../../lib/personnel/schemas";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = fichesPaieFiltresSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerFichesPaie(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = fichePaieCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    const f = await creerFichePaie(ctx, id, parsed.data);
    return ok(f, { status: f.regeneree ? 200 : 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
