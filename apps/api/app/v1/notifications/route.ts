/**
 * GET /v1/notifications — boîte de réception personnelle de l'appelant (Master Spec Partie 3.2,
 * 7.2 — M9).
 */
import { withApiHandler } from "../../../lib/http/handler";
import {
  listerMesNotifications,
  PermissionRefuseeError,
} from "../../../lib/notifications/notifications";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerMesNotifications(ctx);
    return ok(rows);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
