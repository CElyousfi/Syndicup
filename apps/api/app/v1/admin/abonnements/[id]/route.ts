/** GET/PATCH /v1/admin/abonnements/:id — fiche (factures, journal) et modification du prix / des lots. */
import { ok } from "../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../lib/abonnements/http";
import { modifierAbonnement, obtenirAbonnement } from "../../../../../lib/abonnements/abonnements";
import { abonnementUpdateSchema } from "../../../../../lib/abonnements/schemas";

export const GET = routeOperateur<{ id: string }>(async (_req, ctx, { id }) => ok(await obtenirAbonnement(ctx, id)));
export const PATCH = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, abonnementUpdateSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await modifierAbonnement(ctx, id, b.data));
});
