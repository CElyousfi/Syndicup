/** POST /v1/import/upload-url — URL signée d'upload du tableur (xlsx / csv) dans le périmètre `<copro>/import/`. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurImport } from "../../../../lib/import/http";
import { importUploadUrlSchema } from "../../../../lib/import/schemas";
import { preparerUploadImport } from "../../../../lib/import/import";
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = importUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadImport(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
