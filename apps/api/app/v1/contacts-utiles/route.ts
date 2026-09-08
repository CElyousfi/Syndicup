/** GET/POST /v1/contacts-utiles — numéros utiles de la résidence (lecture : tout membre ; gestion : syndic). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurCommunication } from "../../../lib/communication/http";
import { contactUtileSchema } from "../../../lib/communication/schemas";
import { creerContact, listerContacts } from "../../../lib/communication/communication";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await listerContacts(ctx));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = contactUtileSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerContact(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
