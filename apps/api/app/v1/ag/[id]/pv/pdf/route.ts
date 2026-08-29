/**
 * GET /v1/ag/:id/pv/pdf — URL signée 15 min du PDF du procès-verbal (Master Spec Partie 8.6 /
 * 9.3). Même périmètre d'accès que GET /ag/:id/pv ; régénère le PDF sur le chemin canonique si
 * la clôture n'avait pas pu le téléverser.
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import {
  obtenirPvPdfUrl,
  PermissionRefuseeError,
  AgIntrouvableError,
} from "../../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const resultat = await obtenirPvPdfUrl(ctx, id);
    return ok(resultat);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
