/** POST /v1/coproprietes/:id/photos/upload-url — URL signée de téléversement d'une photo de la résidence (syndic). */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { photoUploadUrlSchema } from "../../../../../../lib/coproprietes/schemas";
import { preparerUploadPhoto, PermissionRefuseeError, CoproprieteIntrouvableError } from "../../../../../../lib/coproprietes/coproprietes";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = photoUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadPhoto(ctx, id, parsed.data));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof CoproprieteIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
