/**
 * POST /v1/ag/:id/cloturer — clôture + génération automatique du PV (Master Spec Partie 8.6 — M6).
 */
import {
  cloturerAg,
  PermissionRefuseeError,
  AgIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const result = await cloturerAg(ctx, id);
    return ok(result);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
