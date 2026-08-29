/**
 * GET /v1/finances/synthese — appels de fonds + lignes visibles (RLS) en un seul appel.
 * Endpoint de lecture agrégée pour le frontend (supprime les N+1 des tableaux de bord).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import {
  syntheseFinanciere,
  PermissionRefuseeError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const synthese = await syntheseFinanciere(ctx);
    return ok(synthese);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
