/** GET /v1/import/{id} — état, progression (`nbTraitees` / `nbLignes`), mapping, aperçu, résultat. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok } from "../../../../lib/http/respond";
import { mapErreurImport } from "../../../../lib/import/http";
import { obtenirImport } from "../../../../lib/import/import";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await obtenirImport(ctx, id)); }
  catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
