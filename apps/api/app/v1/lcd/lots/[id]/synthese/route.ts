/** GET /v1/lcd/lots/:id/synthese — déclaration courante, nuits utilisées vs quota, derniers séjours, incidents liés. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../lib/http/respond";
import { syntheseLot, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../../../lib/lcd/lcd";

function mapErreur(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof LcdError) return fail(e.code, e.message);
  return null;
}

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await syntheseLot(ctx, id));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
