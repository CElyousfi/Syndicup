/** DELETE /v1/admin/abonnements/:id/coproprietes/:coproprieteId — retirer une résidence (historique conservé). */
import { ok } from "../../../../../../../lib/http/respond";
import { routeOperateur } from "../../../../../../../lib/abonnements/http";
import { retirerCopropriete } from "../../../../../../../lib/abonnements/abonnements";

export const DELETE = routeOperateur<{ id: string; coproprieteId: string }>(async (_req, ctx, { id, coproprieteId }) => ok(await retirerCopropriete(ctx, id, coproprieteId)));
