/** GET/PUT /v1/coproprietes/:id/comptes-bancaires — comptes de la copropriété (RIB masqué en lecture ; PUT syndic). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { listerComptesBancaires, remplacerComptesBancaires } from "../../../../../lib/justificatifs/comptes-bancaires";
import { comptesBancairesUpdateSchema } from "../../../../../lib/justificatifs/schemas";
import { mapErreurJustificatifs } from "../../../../../lib/justificatifs/http";

type RouteCtx = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await listerComptesBancaires(ctx, id));
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
async function handlePUT(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = comptesBancairesUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await remplacerComptesBancaires(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
export const PUT = withApiHandler(handlePUT);
