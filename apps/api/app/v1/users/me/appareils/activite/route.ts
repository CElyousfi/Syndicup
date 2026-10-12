/**
 * POST /v1/users/me/appareils/activite — le téléphone suit un objet (séance d'AG, ligne d'appel
 * de fonds, incident) : Live Activity iOS (jeton ActivityKit) ou notification persistante Android
 * (jeton FCM). Idempotent par (type, objet, plateforme) — M26.
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { activiteDirectCreateSchema } from "../../../../../../lib/users/schemas";
import { enregistrerActivite } from "../../../../../../lib/notifications/activites";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = activiteDirectCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await enregistrerActivite(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
