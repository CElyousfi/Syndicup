/**
 * GET /v1/ag/:id — détail d'une AG (M6).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { obtenirAg, PermissionRefuseeError, AgIntrouvableError } from "../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const ag = await obtenirAg(ctx, id);
    return ok(ag);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
