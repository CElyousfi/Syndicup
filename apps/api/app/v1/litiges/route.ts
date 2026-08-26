/**
 * GET/POST /v1/litiges — déclaration et liste des litiges (Master Spec Partie 2.2, Doc A §12.1 — M11).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { litigeCreateSchema } from "../../../lib/litiges/schemas";
import {
  creerLitige,
  listerLitiges,
  PermissionRefuseeError,
} from "../../../lib/litiges/litiges";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerLitiges(ctx);
    return ok(rows);
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
    const parsed = litigeCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const litige = await creerLitige(ctx, parsed.data);
    return ok(litige, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
