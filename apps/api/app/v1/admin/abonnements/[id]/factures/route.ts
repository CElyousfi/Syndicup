/** POST /v1/admin/abonnements/:id/factures — émettre la facture de la période suivante (numéro SU-AAAA-NNNN). */
import { ok } from "../../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../../lib/abonnements/http";
import { emettreFacture } from "../../../../../../lib/abonnements/abonnements";
import { factureCreateSchema } from "../../../../../../lib/abonnements/schemas";

export const POST = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, factureCreateSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await emettreFacture(ctx, id, b.data), { status: 201 });
});
