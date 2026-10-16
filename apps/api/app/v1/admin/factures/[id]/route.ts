/** GET /v1/admin/factures/:id — facture complète (lignes, client, paiements) pour affichage et impression. */
import { ok } from "../../../../../lib/http/respond";
import { routeOperateur } from "../../../../../lib/abonnements/http";
import { obtenirFacture } from "../../../../../lib/abonnements/abonnements";

export const GET = routeOperateur<{ id: string }>(async (_req, ctx, { id }) => ok(await obtenirFacture(ctx, id)));
