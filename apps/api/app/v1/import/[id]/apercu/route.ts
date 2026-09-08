/** GET /v1/import/{id}/apercu — 20 premières lignes projetées sur le mapping, erreurs / avertissements par ligne, avertissements globaux. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurImport } from "../../../../../lib/import/http";
import { apercuImport } from "../../../../../lib/import/import";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try { const ctx = await tenantFromRequest(req); const { id } = await params; return ok(await apercuImport(ctx, id)); }
  catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
