/** GET /v1/admin/factures — factures d'abonnement (filtres : statut, en_retard). */
import { ok, fail } from "../../../../lib/http/respond";
import { routeOperateur } from "../../../../lib/abonnements/http";
import { listerFactures } from "../../../../lib/abonnements/abonnements";

export const GET = routeOperateur(async (req, ctx) => {
  const sp = new URL(req.url).searchParams;
  const statut = sp.get("statut") ?? undefined;
  if (statut && !["EMISE", "PAYEE", "ANNULEE"].includes(statut)) return fail("VALIDATION_ERROR", "Statut de facture inconnu.");
  return ok(await listerFactures(ctx, { statut: statut as "EMISE" | "PAYEE" | "ANNULEE" | undefined, en_retard: sp.get("en_retard") === "true" }));
});
