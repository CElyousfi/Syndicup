/**
 * GET /v1/ag/:id/pv — consultation du PV (Doc A §12.3 : accessible à tous les copropriétaires — M6).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { obtenirPv, PermissionRefuseeError, AgIntrouvableError } from "../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const pv = await obtenirPv(ctx, id);
    return ok(pv);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
