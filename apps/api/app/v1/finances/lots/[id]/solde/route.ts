/**
 * GET /v1/finances/lots/:id/solde — solde de charges d'un lot (Master Spec Partie 4.2 — M5).
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import {
  obtenirSoldeLot,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const solde = await obtenirSoldeLot(ctx, id);
    return ok(solde);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
