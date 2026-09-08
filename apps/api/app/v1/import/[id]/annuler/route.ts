/** POST /v1/import/{id}/annuler — arrêt entre deux chunks (les lignes déjà appliquées restent). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurImport } from "../../../../../lib/import/http";
import { annulerImport } from "../../../../../lib/import/import";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await annulerImport(ctx, id)); }
  catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
