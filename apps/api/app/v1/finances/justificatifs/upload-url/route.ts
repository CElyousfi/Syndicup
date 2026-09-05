/** POST /v1/finances/justificatifs/upload-url — URL signée d'upload de la preuve (préfixe `<copropriete>/justificatifs/`). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { preparerUploadJustificatif } from "../../../../../lib/justificatifs/justificatifs";
import { justificatifUploadUrlSchema } from "../../../../../lib/justificatifs/schemas";
import { mapErreurJustificatifs } from "../../../../../lib/justificatifs/http";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = justificatifUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadJustificatif(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
