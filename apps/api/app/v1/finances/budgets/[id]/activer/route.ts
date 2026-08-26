/**
 * POST /v1/finances/budgets/:id/activer — activation (+ budget rectificatif : l'ACTIF existant
 * du même exercice passe REMPLACE dans la même transaction, Doc A §3.2) — M12.
 */
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { withApiHandler } from "../../../../../../lib/http/handler";
import { activerBudget } from "../../../../../../lib/finances/budgets";
import {
  PermissionRefuseeError,
  RessourceIntrouvableError,
  ContrainteMetierError,
} from "../../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await activerBudget(ctx, id, readIdempotencyKey(req)));
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
