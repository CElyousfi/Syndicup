/**
 * GET /v1/abonnement — état de l'abonnement SyndicUp de la copropriété courante (M29).
 * Toujours joignable, même résidence bloquée (route libre du contrôle d'accès) : sert à afficher
 * la fenêtre de rappel (syndic) ou l'écran de suspension (tout le monde).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { ok } from "../../../lib/http/respond";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { etatPourLaResidence } from "../../../lib/abonnements/acces";

async function handleGET(req: Request) {
  try {
    return ok(await etatPourLaResidence(await tenantFromRequest(req)));
  } catch (e) {
    const m = mapAuthError(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
