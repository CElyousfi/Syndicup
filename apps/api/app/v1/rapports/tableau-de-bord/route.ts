/** GET /v1/rapports/tableau-de-bord — indicateurs de gestion (syndic / conseil), M18 Doc A §8. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { tableauDeBord } from "../../../../lib/rapports/tableau-de-bord";
import { exerciceQuerySchema } from "../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../lib/rapports/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = exerciceQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await tableauDeBord(ctx, parsed.data.exercice));
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
