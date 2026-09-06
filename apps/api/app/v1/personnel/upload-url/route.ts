/** POST /v1/personnel/upload-url — URL signée d'upload (contrat de travail, certificat) dans <copropriete>/personnel/. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../lib/personnel/http";
import { preparerUploadPersonnel } from "../../../../lib/personnel/rh";
import { personnelUploadUrlSchema } from "../../../../lib/personnel/schemas";
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = personnelUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadPersonnel(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
void readIdempotencyKey;
export const POST = withApiHandler(handlePOST);
