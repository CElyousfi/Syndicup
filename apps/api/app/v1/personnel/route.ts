/**
 * GET/POST /v1/personnel — registre du personnel gardien (Master Spec Partie 13.3, Doc A §9 — M10).
 */
import { personnelCreateSchema } from "../../../lib/personnel/schemas";
import {
  creerPersonnel,
  listerPersonnel,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../lib/personnel/personnel";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

export async function GET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerPersonnel(ctx);
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
    const parsed = personnelCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const fiche = await creerPersonnel(ctx, parsed.data);
    return ok(fiche, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
