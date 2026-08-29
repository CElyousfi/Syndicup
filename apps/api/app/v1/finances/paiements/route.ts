/**
 * POST /v1/finances/paiements — enregistrement d'un paiement manuel (virement/espèces/chèque)
 * (Master Spec Partie 4.2/6.4, Doc A §3.4 — M5).
 */
import { enforceRateLimit } from "../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../lib/rate-limit";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { withApiHandler } from "../../../../lib/http/handler";
import { paiementManuelCreateSchema } from "../../../../lib/finances/schemas";
import {
  enregistrerPaiementManuel,
  listerPaiements,
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

/** GET /v1/finances/paiements?exercice=YYYY — journal des paiements (RLS : périmètre du rôle). */
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const exercice = new URL(req.url).searchParams.get("exercice") ?? undefined;
    return ok(await listerPaiements(ctx, exercice));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const limite = await enforceRateLimit(req, "ecriture-financiere", RATE_LIMITS.ecritureFinanciere(), ctx.utilisateurId);
    if (limite) return limite;
    const body = await req.json().catch(() => null);
    const parsed = paiementManuelCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const resultat = await enregistrerPaiementManuel(ctx, parsed.data, readIdempotencyKey(req));
    return ok(resultat, { status: 201 });
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
export const GET = withApiHandler(handleGET);
