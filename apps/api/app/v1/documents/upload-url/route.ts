/**
 * POST /v1/documents/upload-url — URL signée d'upload vers le bucket privé `documents`
 * (Master Spec Partie 9.3 — M9). Rôle autorisé : syndic. Le client téléverse directement au
 * Storage (exception d'architecture autorisée) puis appelle POST /documents avec le
 * storage_path retourné.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { documentUploadUrlSchema } from "../../../../lib/documents/schemas";
import { preparerUpload, PermissionRefuseeError } from "../../../../lib/documents/documents";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = documentUploadUrlSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const resultat = await preparerUpload(ctx, parsed.data);
    return ok(resultat, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
