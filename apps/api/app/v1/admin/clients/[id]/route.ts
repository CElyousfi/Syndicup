/** GET/PATCH /v1/admin/clients/:id — fiche client (abonnements, factures) et modification. */
import { ok } from "../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../lib/abonnements/http";
import { modifierClient, obtenirClient } from "../../../../../lib/abonnements/abonnements";
import { clientUpdateSchema } from "../../../../../lib/abonnements/schemas";

export const GET = routeOperateur<{ id: string }>(async (_req, ctx, { id }) => ok(await obtenirClient(ctx, id)));
export const PATCH = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, clientUpdateSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await modifierClient(ctx, id, b.data));
});
