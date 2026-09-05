/**
 * POST /v1/users/me/appareils — enregistre le jeton push (FCM) de l'appareil de l'appelant
 * (Master Spec Partie 13.4 — client mobile M12). Idempotent par jeton.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { appareilPushCreateSchema } from "../../../../../lib/users/schemas";
import { enregistrerAppareil } from "../../../../../lib/users/appareils";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = appareilPushCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await enregistrerAppareil(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
