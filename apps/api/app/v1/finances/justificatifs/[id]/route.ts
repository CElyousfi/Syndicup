/** GET /v1/finances/justificatifs/:id — détail, URL signée de la preuve (15 min), lignes ouvertes du lot. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { obtenirJustificatif } from "../../../../../lib/justificatifs/justificatifs";
import { mapErreurJustificatifs } from "../../../../../lib/justificatifs/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirJustificatif(ctx, id));
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
