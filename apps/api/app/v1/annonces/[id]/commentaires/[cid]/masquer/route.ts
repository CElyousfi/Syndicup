/** POST /v1/annonces/{id}/commentaires/{cid}/masquer — modération (syndic) : le commentaire reste en base, masqué. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok } from "../../../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../../../lib/communication/http";
type P = { params: Promise<{ id: string; cid: string }> };
import { masquerCommentaire } from "../../../../../../../lib/communication/communication";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, cid } = await params;
    return ok(await masquerCommentaire(ctx, id, cid));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
