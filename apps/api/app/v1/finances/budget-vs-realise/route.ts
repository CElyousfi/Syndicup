/** GET /v1/finances/budget-vs-realise?exercice= — prévu / engagé / réalisé par poste (M16, base du tableau de bord M18). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { budgetVsRealise } from "../../../../lib/depenses/rapports";
import { budgetVsRealiseQuerySchema } from "../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../lib/depenses/http";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = budgetVsRealiseQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await budgetVsRealise(ctx, parsed.data.exercice));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
