/**
 * PATCH /v1/notifications/:id/read — marque une notification comme lue (Master Spec Partie 3.2
 * — M9).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import {
  marquerLue,
  PermissionRefuseeError,
  IntrouvableError,
} from "../../../../../lib/notifications/notifications";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const notification = await marquerLue(ctx, id);
    return ok(notification);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const PATCH = withApiHandler(handlePATCH);
