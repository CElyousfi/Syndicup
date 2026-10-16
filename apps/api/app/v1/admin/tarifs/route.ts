/** GET /v1/admin/tarifs — prix proposé par la grille (formule, lots, périodicité, fondateur). */
import { ok, failZod } from "../../../../lib/http/respond";
import { routeOperateur } from "../../../../lib/abonnements/http";
import { exigerOperateurSeul } from "../../../../lib/abonnements/operateur";
import { tarifQuerySchema } from "../../../../lib/abonnements/schemas";
import { tarifSuggere } from "../../../../lib/abonnements/tarifs";

export const GET = routeOperateur(async (req, ctx) => {
  exigerOperateurSeul(ctx);
  const parsed = tarifQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return failZod(parsed.error);
  return ok(tarifSuggere(parsed.data));
});
