/**
 * GET /v1/users/me/widget — instantané compact pour les widgets d'écran d'accueil / écran
 * verrouillé du mobile. Lecture seule, par rôle ; cache privé court (le téléphone rafraîchit
 * au retour au premier plan et après chaque action).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { instantaneWidget, PermissionRefuseeError } from "../../../../../lib/users/widget";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const res = ok(await instantaneWidget(ctx));
    res.headers.set("Cache-Control", "private, max-age=60");
    return res;
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
