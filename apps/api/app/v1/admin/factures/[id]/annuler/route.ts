/** POST /v1/admin/factures/:id/annuler — annuler une facture émise sans paiement (numéro conservé, motif tracé). */
import { ok } from "../../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../../lib/abonnements/http";
import { annulerFacture } from "../../../../../../lib/abonnements/abonnements";
import { factureAnnulerSchema } from "../../../../../../lib/abonnements/schemas";

export const POST = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, factureAnnulerSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await annulerFacture(ctx, id, b.data.motif));
});
