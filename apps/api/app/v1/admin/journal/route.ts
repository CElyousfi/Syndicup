/** GET /v1/admin/journal — journal des abonnements (append-only), le plus récent d'abord. */
import { ok } from "../../../../lib/http/respond";
import { routeOperateur } from "../../../../lib/abonnements/http";
import { journalAbonnements } from "../../../../lib/abonnements/abonnements";

export const GET = routeOperateur(async (req, ctx) => {
  const limite = Number(new URL(req.url).searchParams.get("limite") ?? "200");
  return ok(await journalAbonnements(ctx, Number.isFinite(limite) && limite > 0 ? limite : 200));
});
