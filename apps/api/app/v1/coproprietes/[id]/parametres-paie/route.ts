/** GET/PATCH /v1/coproprietes/{id}/parametres-paie — paramètres de paie (syndic) : CNSS, AMO, IR, SMIG, congés — PROVISOIRES (brief §11). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../lib/personnel/http";
import { definirParametresPaie, lireParametresPaieCopro } from "../../../../../lib/personnel/rh";
import { parametresPaieUpdateSchema } from "../../../../../lib/personnel/schemas";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request) {
  try { const ctx = await tenantFromRequest(req); return ok(await lireParametresPaieCopro(ctx)); }
  catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = parametresPaieUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await definirParametresPaie(ctx, id, parsed.data.parametres_paie));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
