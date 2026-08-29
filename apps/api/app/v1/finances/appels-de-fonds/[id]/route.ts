/**
 * GET /v1/finances/appels-de-fonds/:id — détail d'un appel de fonds avec ses lignes par lot
 * (Master Spec Partie 6.2). La RLS sur appel_de_fonds_lot restreint les lignes visibles au
 * périmètre de l'appelant (un résident ne voit que ses propres lots — Doc A §12.3).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import {
  obtenirAppelDeFonds,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const appel = await obtenirAppelDeFonds(ctx, id);
    return ok(appel);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
