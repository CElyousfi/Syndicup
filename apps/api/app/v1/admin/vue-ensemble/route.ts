/** GET /v1/admin/vue-ensemble — tableau de bord opérateur : revenus, abonnements par état, à traiter. */
import { ok } from "../../../../lib/http/respond";
import { routeOperateur } from "../../../../lib/abonnements/http";
import { vueEnsemble } from "../../../../lib/abonnements/abonnements";

export const GET = routeOperateur(async (_req, ctx) => ok(await vueEnsemble(ctx)));
