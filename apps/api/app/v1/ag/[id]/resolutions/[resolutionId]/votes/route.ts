/**
 * GET /v1/ag/:id/resolutions/:resolutionId/votes — détail nominatif (syndic only, Doc A §12.3 — M6).
 */
import { listerVotesNominatifs, PermissionRefuseeError } from "../../../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../../lib/http/respond";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; resolutionId: string }> }
) {
  try {
    const ctx = await tenantFromRequest(req);
    const { resolutionId } = await params;
    const votes = await listerVotesNominatifs(ctx, resolutionId);
    return ok(votes);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}
