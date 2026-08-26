/**
 * GET/POST /v1/ag — liste et création d'AG (Master Spec Partie 2.2/8, Doc A §6 — M6).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { agCreateSchema } from "../../../lib/ag/schemas";
import { creerAg, listerAg, PermissionRefuseeError } from "../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const { total, rows } = await listerAg(ctx, page, limit);
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
    const parsed = agCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const ag = await creerAg(ctx, parsed.data);
    return ok(ag, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
