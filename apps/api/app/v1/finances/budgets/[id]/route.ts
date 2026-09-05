/**
 * GET/PATCH /v1/finances/budgets/:id — détail et modification (statut PROPOSE uniquement) — M12.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { budgetAgUpdateSchema } from "../../../../../lib/finances/schemas";
import { obtenirBudget, modifierBudget } from "../../../../../lib/finances/budgets";
import {
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/finances/finances";
import { BudgetPosteError } from "../../../../../lib/depenses/budget-postes";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

type RouteCtx = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirBudget(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

async function handlePATCH(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = budgetAgUpdateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierBudget(ctx, id, parsed.data));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof BudgetPosteError) return fail(e.code, e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
