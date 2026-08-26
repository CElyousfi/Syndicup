/**
 * GET /v1/finances/quittances/:id — consultation d'une quittance (Master Spec Partie 4.2 — M5).
 */
import {
  obtenirQuittance,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const quittance = await obtenirQuittance(ctx, id);
    return ok(quittance);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}
