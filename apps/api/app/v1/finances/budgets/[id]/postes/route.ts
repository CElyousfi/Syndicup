/** GET/POST /v1/finances/budgets/:id/postes — lignes du budget (M16). Lecture large, écriture syndic. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { listerPostes, creerPoste } from "../../../../../../lib/depenses/budget-postes";
import { budgetPosteCreateSchema } from "../../../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../../../lib/depenses/http";

type RouteCtx = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await listerPostes(ctx, id));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = budgetPosteCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerPoste(ctx, id, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
