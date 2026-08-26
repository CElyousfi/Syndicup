/**
 * POST /v1/ag/:id/procurations/:procurationId/revoquer — retrait de procuration (Doc A §6.5 — M6).
 */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import {
  revoquerProcuration,
  PermissionRefuseeError,
  AgIntrouvableError,
  ContrainteMetierError,
} from "../../../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../../lib/http/respond";

async function handlePOST(
  req: Request,
  { params }: { params: Promise<{ id: string; procurationId: string }> }
) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, procurationId } = await params;
    const procuration = await revoquerProcuration(ctx, id, procurationId);
    return ok(procuration);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
