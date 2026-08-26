/**
 * GET/POST /v1/finances/budgets — budgets AG (Master Spec Partie 2.2, Doc A §3.2 — M12).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { budgetAgCreateSchema } from "../../../../lib/finances/schemas";
import { listerBudgets, creerBudget } from "../../../../lib/finances/budgets";
import {
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const { total, rows } = await listerBudgets(ctx, page, limit);
    return ok(rows, { meta: { total, page, has_more: page * limit < total } });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = budgetAgCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const budget = await creerBudget(ctx, parsed.data);
    return ok(budget, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
