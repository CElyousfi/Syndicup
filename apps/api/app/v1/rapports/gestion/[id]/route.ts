/** GET /v1/rapports/gestion/{id} — détail + instantané complet (syndic / conseil). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { obtenirRapportGestion } from "../../../../../lib/rapports/gestion";
import { mapErreurRapports } from "../../../../../lib/rapports/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirRapportGestion(ctx, id));
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
