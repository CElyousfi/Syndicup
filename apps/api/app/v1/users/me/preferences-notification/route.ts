/** GET/PUT /v1/users/me/preferences-notification — préférences de notification de l'appelant (M21 : digest hebdo, canal, push annonces). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
import { preferencesNotificationSchema } from "../../../../../lib/communication/schemas";
import { definirPreferencesNotification, lirePreferencesNotification } from "../../../../../lib/communication/communication";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await lirePreferencesNotification(ctx));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handlePUT(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = preferencesNotificationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await definirPreferencesNotification(ctx, parsed.data));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const PUT = withApiHandler(handlePUT);
