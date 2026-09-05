/** GET /v1/finances/lots/{id}/releve?exercice= — relevé de charges du lot (« état daté », Doc A §11), journalisé. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { obtenirReleveLot } from "../../../../../../lib/rapports/releve";
import { releveQuerySchema } from "../../../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../../../lib/rapports/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = releveQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await obtenirReleveLot(ctx, id, parsed.data.exercice ?? String(new Date().getUTCFullYear())));
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
