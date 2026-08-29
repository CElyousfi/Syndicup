/**
 * GET /v1/coproprietes/:id/synthese-admin — santé d'une copropriété pour la console
 * opérateur (super_admin uniquement) : compteurs + montants (chaînes décimales),
 * prochaine AG, dernière activité.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import {
  syntheseAdmin,
  PermissionRefuseeError,
  CoproprieteIntrouvableError,
} from "../../../../../lib/coproprietes/coproprietes";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await syntheseAdmin(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof CoproprieteIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
