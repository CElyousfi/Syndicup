/** POST /v1/admin/abonnements/:id/actions — prolonger l'essai, accorder un délai, activer, suspendre, réactiver, résilier. */
import { ok } from "../../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../../lib/abonnements/http";
import { actionAbonnement } from "../../../../../../lib/abonnements/abonnements";
import { abonnementActionSchema } from "../../../../../../lib/abonnements/schemas";

export const POST = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, abonnementActionSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await actionAbonnement(ctx, id, b.data));
});
