/** GET /v1/import/{id}/rapport.csv — résultat ligne à ligne (n°, résultat, message). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { mapErreurImport } from "../../../../../lib/import/http";
import { reponseExport } from "../../../../../lib/http/export";
import { rapportImport } from "../../../../../lib/import/import";
type P = { params: Promise<{ id: string }> };
async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const { entetes, lignes } = await rapportImport(ctx, id);
    return reponseExport("csv", `import-${id.slice(0, 8)}-rapport`, entetes, lignes);
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
