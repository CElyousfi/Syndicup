/**
 * GET/POST /v1/lots — liste et création de lots (Master Spec Partie 2.2, Doc A §1 — M3).
 */
import { lotCreateSchema } from "../../../lib/lots/schemas";
import {
  creerLot,
  listerLots,
  PermissionRefuseeError,
  ContrainteMetierError,
} from "../../../lib/lots/lots";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

export async function GET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const { total, rows } = await listerLots(ctx, page, limit);
    return ok(rows, { meta: { total, page, has_more: page * limit < total } });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = lotCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const lot = await creerLot(ctx, parsed.data);
    return ok(lot, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
