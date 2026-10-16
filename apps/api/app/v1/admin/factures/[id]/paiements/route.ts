/**
 * POST /v1/admin/factures/:id/paiements — enregistrer un paiement reçu (virement, chèque…).
 * Écriture financière : Idempotency-Key obligatoire. Facture soldée → période payée avancée,
 * abonnement ACTIF, accès rouvert.
 */
import { ok } from "../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { corps, routeOperateur } from "../../../../../../lib/abonnements/http";
import { enregistrerPaiement } from "../../../../../../lib/abonnements/abonnements";
import { paiementCreateSchema } from "../../../../../../lib/abonnements/schemas";

export const POST = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const cle = readIdempotencyKey(req);
  const b = await corps(req, paiementCreateSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await enregistrerPaiement(ctx, id, b.data, cle), { status: 201 });
});
