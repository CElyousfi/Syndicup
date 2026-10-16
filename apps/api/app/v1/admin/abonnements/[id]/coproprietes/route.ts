/** POST /v1/admin/abonnements/:id/coproprietes — rattacher une résidence (une seule couverture active par résidence). */
import { ok } from "../../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../../lib/abonnements/http";
import { rattacherCopropriete } from "../../../../../../lib/abonnements/abonnements";
import { rattacherCoproprieteSchema } from "../../../../../../lib/abonnements/schemas";

export const POST = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, rattacherCoproprieteSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await rattacherCopropriete(ctx, id, b.data.copropriete_id), { status: 201 });
});
