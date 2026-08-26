/**
 * POST /v1/ag/:id/resolutions/:resolutionId/finaliser — calcule ADOPTEE/REJETEE (Master Spec
 * Partie 8.4 — M6, ajout nécessaire, voir permissions.ts "ag.finaliser_resolution").
 */
import {
  finaliserResolution,
  PermissionRefuseeError,
  AgIntrouvableError,
  ContrainteMetierError,
} from "../../../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../../lib/http/respond";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; resolutionId: string }> }
) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, resolutionId } = await params;
    const resolution = await finaliserResolution(ctx, id, resolutionId);
    return ok(resolution);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
