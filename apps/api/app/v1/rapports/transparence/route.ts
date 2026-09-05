/** GET /v1/rapports/transparence — « où va mon argent » : agrégats anonymisés pour tout membre (Doc A §3.5). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { vueTransparence } from "../../../../lib/rapports/transparence";
import { transparenceQuerySchema } from "../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = transparenceQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    const { meta, ...data } = await vueTransparence(ctx, parsed.data.exercice, { page: parsed.data.page, limit: parsed.data.limit });
    return ok(data, { meta });
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
