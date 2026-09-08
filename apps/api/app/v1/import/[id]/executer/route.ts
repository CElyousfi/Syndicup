/** POST /v1/import/{id}/executer — lance l'exécution (job Inngest, chunks idempotents) ; `?sync=1` exécute en ligne (petits fichiers). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { mapErreurImport } from "../../../../../lib/import/http";
import { lancerImport } from "../../../../../lib/import/import";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const enLigne = new URL(req.url).searchParams.get("sync") === "1";
    return ok(await lancerImport(ctx, id, { enLigne }), { status: 202 });
  } catch (e) { const m = mapErreurImport(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
