/** POST /v1/annonces/upload-url — URL signée d'upload d'une pièce jointe (périmètre `<copropriete>/communication/`). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../lib/communication/http";
import { communicationUploadUrlSchema } from "../../../../lib/communication/schemas";
import { preparerUploadCommunication } from "../../../../lib/communication/communication";
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = communicationUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadCommunication(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
