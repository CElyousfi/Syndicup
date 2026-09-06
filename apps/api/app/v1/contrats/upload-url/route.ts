/** POST /v1/contrats/upload-url — URL signée d'upload (contrat signé, attestation d'assurance) dans `<copropriete>/contrats/`. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { preparerUploadContrat } from "../../../../lib/contrats/contrats";
import { contratUploadUrlSchema } from "../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../lib/contrats/http";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = contratUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadContrat(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
