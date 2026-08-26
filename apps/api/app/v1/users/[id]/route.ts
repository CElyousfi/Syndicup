/**
 * GET /v1/users/:id — fiche d'un membre de la copropriété (syndic uniquement — M13).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import {
  obtenirFicheUtilisateur,
  PermissionRefuseeError,
  UtilisateurIntrouvableError,
} from "../../../../lib/users/users";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirFicheUtilisateur(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof UtilisateurIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
