/**
 * POST /v1/finances/paiements/cmi/webhook — callback CMI (Master Spec Partie 6.4, étapes 3-5).
 *
 * Endpoint machine-à-machine : PAS de JWT Supabase (CMI n'en fournit pas), la vérification de
 * légitimité se fait exclusivement par la signature HMAC (voir
 * apps/api/lib/finances/finances.ts::traiterWebhookCmi). N'utilise donc PAS tenantFromRequest.
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { paiementCmiWebhookSchema } from "../../../../../../lib/finances/schemas";
import {
  traiterWebhookCmi,
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
  ConflitIdempotenceError,
} from "../../../../../../lib/finances/finances";
import { ok, fail, failZod } from "../../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = paiementCmiWebhookSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const resultat = await traiterWebhookCmi(parsed.data);
    return ok(resultat);
  } catch (e) {
    if (e instanceof ConflitIdempotenceError) {
      // Rejeu du même callback : pas une erreur du point de vue de CMI, l'idempotence est déjà
      // garantie côté service — on répond 200 pour éviter que CMI ne re-tente indéfiniment.
      return ok({ idempotent: true, message: e.message });
    }
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
