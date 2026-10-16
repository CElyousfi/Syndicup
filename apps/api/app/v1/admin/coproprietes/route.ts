/** GET /v1/admin/coproprietes — toutes les résidences avec leur abonnement, lots réels et comptes actifs. */
import { ok } from "../../../../lib/http/respond";
import { routeOperateur } from "../../../../lib/abonnements/http";
import { listerCoproprietesAdmin } from "../../../../lib/abonnements/abonnements";

export const GET = routeOperateur(async (req, ctx) => ok(await listerCoproprietesAdmin(ctx, new URL(req.url).searchParams.get("q") ?? undefined)));
