/** POST /v1/taches/upload-url — URL signée d'upload d'une pièce jointe (photo de fin de tâche, PDF). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurTaches } from "../../../../lib/taches/http";
import { tacheUploadUrlSchema } from "../../../../lib/taches/schemas";
import { preparerUploadTache } from "../../../../lib/taches/taches";
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = tacheUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadTache(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurTaches(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
