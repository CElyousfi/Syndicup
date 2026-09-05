/** PATCH/DELETE /v1/finances/budgets/:id/postes/:posteId — modification / suppression d'une ligne (syndic). */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { modifierPoste, supprimerPoste } from "../../../../../../../lib/depenses/budget-postes";
import { budgetPosteUpdateSchema } from "../../../../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../../../../lib/depenses/http";

type RouteCtx = { params: Promise<{ id: string; posteId: string }> };

async function handlePATCH(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, posteId } = await params;
    const parsed = budgetPosteUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierPoste(ctx, id, posteId, parsed.data));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

async function handleDELETE(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, posteId } = await params;
    return ok(await supprimerPoste(ctx, id, posteId));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
