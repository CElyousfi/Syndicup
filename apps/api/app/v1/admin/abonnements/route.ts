/** GET/POST /v1/admin/abonnements — liste (filtre par état calculé) et ouverture d'un abonnement. */
import { ok, fail } from "../../../../lib/http/respond";
import { corps, routeOperateur } from "../../../../lib/abonnements/http";
import { creerAbonnement, listerAbonnements } from "../../../../lib/abonnements/abonnements";
import { abonnementCreateSchema } from "../../../../lib/abonnements/schemas";
import type { EtatAbonnement } from "../../../../lib/abonnements/etat";

const ETATS = new Set(["SANS_ABONNEMENT", "EN_ESSAI", "A_JOUR", "RENOUVELLEMENT_PROCHE", "ESSAI_EXPIRE", "EN_RETARD", "ACCES_PROLONGE", "BLOQUE_IMPAYE", "SUSPENDU", "RESILIE"]);

export const GET = routeOperateur(async (req, ctx) => {
  const sp = new URL(req.url).searchParams;
  const etat = sp.get("etat") ?? undefined;
  if (etat && !ETATS.has(etat)) return fail("VALIDATION_ERROR", "Filtre d'état inconnu.");
  return ok(await listerAbonnements(ctx, { etat: etat as EtatAbonnement | undefined, q: sp.get("q") ?? undefined }));
});
export const POST = routeOperateur(async (req, ctx) => {
  const b = await corps(req, abonnementCreateSchema);
  if ("erreur" in b) return b.erreur;
  return ok(await creerAbonnement(ctx, b.data), { status: 201 });
});
