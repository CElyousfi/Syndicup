/** PATCH /v1/admin/utilisateurs/:id — suspendre / réactiver un compte (tracé dans l'audit_log de ses résidences). */
import { ok } from "../../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../../lib/abonnements/http";
import { modifierStatutUtilisateur } from "../../../../../lib/abonnements/abonnements";
import { utilisateurStatutSchema } from "../../../../../lib/abonnements/schemas";

export const PATCH = routeOperateur<{ id: string }>(async (req, ctx, { id }) => {
  const b = await corps(req, utilisateurStatutSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await modifierStatutUtilisateur(ctx, id, b.data.statut_compte, b.data.motif));
});
