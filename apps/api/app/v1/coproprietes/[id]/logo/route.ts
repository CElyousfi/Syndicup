/** GET /v1/coproprietes/:id/logo — URL signée (15 min) du logo de la résidence, ou null. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { urlLogo, PermissionRefuseeError, CoproprieteIntrouvableError } from "../../../../../lib/coproprietes/coproprietes";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await urlLogo(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof CoproprieteIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
