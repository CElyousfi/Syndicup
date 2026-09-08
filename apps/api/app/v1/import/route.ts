/** GET/POST /v1/import — imports du tableur (M24) : historique ; création = fichier attaché (IMPORT_SOURCE) + analyse immédiate (colonnes détectées, aperçu, avertissements). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurImport } from "../../../lib/import/http";
import { importCreateSchema, importsFiltresSchema } from "../../../lib/import/schemas";
import { creerImport, listerImports } from "../../../lib/import/import";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = importsFiltresSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerImports(ctx, parsed.data));
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = importCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerImport(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
