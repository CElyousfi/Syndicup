/** GET/PATCH /v1/personnel/{id} — fiche RH (complète pour le syndic / l'employé ; fiche d'urgence pour les autres) ; modification RH (syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../lib/personnel/http";
import { obtenirPersonnel, modifierPersonnelRh } from "../../../../lib/personnel/rh";
import { personnelRhUpdateSchema } from "../../../../lib/personnel/schemas";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await obtenirPersonnel(ctx, id)); }
  catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req); const { id } = await params;
    const parsed = personnelRhUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierPersonnelRh(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
