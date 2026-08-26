/**
 * POST /v1/finances/paiements/cmi/initier — création d'une session de paiement CMI
 * (Master Spec Partie 6.4, étape 1 — M5).
 */
import { enforceRateLimit } from "../../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../../lib/rate-limit";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { withApiHandler } from "../../../../../../lib/http/handler";
import { paiementCmiInitierSchema } from "../../../../../../lib/finances/schemas";
import {
  initierPaiementCmi,
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
} from "../../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const limite = await enforceRateLimit(req, "ecriture-financiere", RATE_LIMITS.ecritureFinanciere(), ctx.utilisateurId);
    if (limite) return limite;
    const body = await req.json().catch(() => null);
    const parsed = paiementCmiInitierSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const session = await initierPaiementCmi(ctx, parsed.data, readIdempotencyKey(req));
    return ok(session, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
