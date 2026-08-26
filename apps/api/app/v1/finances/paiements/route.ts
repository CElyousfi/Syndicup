/**
 * POST /v1/finances/paiements — enregistrement d'un paiement manuel (virement/espèces/chèque)
 * (Master Spec Partie 4.2/6.4, Doc A §3.4 — M5).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { paiementManuelCreateSchema } from "../../../../lib/finances/schemas";
import {
  enregistrerPaiementManuel,
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = paiementManuelCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const resultat = await enregistrerPaiementManuel(ctx, parsed.data);
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
