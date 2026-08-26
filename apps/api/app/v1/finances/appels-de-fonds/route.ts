/**
 * GET/POST /v1/finances/appels-de-fonds — génération batch et liste (Master Spec Partie 6.2 — M5).
 */
import { appelDeFondsGenererSchema } from "../../../../lib/finances/schemas";
import {
  genererAppelDeFonds,
  listerAppelsDeFonds,
  PermissionRefuseeError,
  ContrainteMetierError,
  ConflitIdempotenceError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

export async function GET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const { total, rows } = await listerAppelsDeFonds(ctx, page, limit);
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
    const parsed = appelDeFondsGenererSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const appel = await genererAppelDeFonds(ctx, parsed.data);
    return ok(appel, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof ConflitIdempotenceError) return fail("CONFLICT", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
