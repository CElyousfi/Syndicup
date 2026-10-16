/** GET /v1/admin/utilisateurs — recherche des comptes de la plateforme (paginée, 50 par page). */
import { ok } from "../../../../lib/http/respond";
import { routeOperateur } from "../../../../lib/abonnements/http";
import { listerUtilisateurs } from "../../../../lib/abonnements/abonnements";

export const GET = routeOperateur(async (req, ctx) => {
  const sp = new URL(req.url).searchParams;
  return ok(await listerUtilisateurs(ctx, sp.get("q") ?? undefined, Math.max(1, Number(sp.get("page") ?? "1") || 1)));
});
