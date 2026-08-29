/**
 * GET /v1/users — annuaire des membres de la copropriété courante (syndic).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { listerMembres, PermissionRefuseeError } from "../../../lib/users/users";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await listerMembres(ctx));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
