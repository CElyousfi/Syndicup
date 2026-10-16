/** GET/POST /v1/admin/clients — clients facturés (syndicats et cabinets). */
import { ok } from "../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../lib/abonnements/http";
import { creerClient, listerClients } from "../../../../lib/abonnements/abonnements";
import { clientCreateSchema } from "../../../../lib/abonnements/schemas";

export const GET = routeOperateur(async (req, ctx) => ok(await listerClients(ctx, new URL(req.url).searchParams.get("q") ?? undefined)));
export const POST = routeOperateur(async (req, ctx) => {
  const b = await corps(req, clientCreateSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await creerClient(ctx, b.data), { status: 201 });
});
