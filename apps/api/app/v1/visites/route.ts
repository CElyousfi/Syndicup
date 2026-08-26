/**
 * GET/POST /v1/visites — contrôle d'accès visiteurs (Master Spec Partie 13.3, Doc A §9.2 — M10).
 */
import { visiteCreateSchema } from "../../../lib/personnel/schemas";
import {
  creerVisite,
  listerVisites,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../lib/personnel/personnel";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

export async function GET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const lotId = new URL(req.url).searchParams.get("lot_id") ?? undefined;
    const rows = await listerVisites(ctx, lotId);
    return ok(rows);
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
    const parsed = visiteCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const visite = await creerVisite(ctx, parsed.data);
    return ok(visite, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
