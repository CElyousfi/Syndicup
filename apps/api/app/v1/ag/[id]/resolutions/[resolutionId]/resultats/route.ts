/**
 * GET /v1/ag/:id/resolutions/:resolutionId/resultats — résultats agrégés/anonymisés (Doc A §12.3 — M6).
 */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { obtenirResultatsResolution, PermissionRefuseeError } from "../../../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../../lib/http/respond";

async function handleGET(
  req: Request,
  { params }: { params: Promise<{ id: string; resolutionId: string }> }
) {
  try {
    const ctx = await tenantFromRequest(req);
    const { resolutionId } = await params;
    const resultats = await obtenirResultatsResolution(ctx, resolutionId);
    return ok(resultats);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
