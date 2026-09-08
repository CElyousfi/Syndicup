/** PATCH/DELETE /v1/contacts-utiles/{id} — modification / suppression (syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { contactUtileUpdateSchema } from "../../../../lib/communication/schemas";
import { modifierContact, supprimerContact } from "../../../../lib/communication/communication";
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = contactUtileUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierContact(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
async function handleDELETE(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await supprimerContact(ctx, id));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
