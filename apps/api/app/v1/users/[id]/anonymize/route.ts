/**
 * POST /v1/users/:id/anonymize — anonymisation CNDP manuelle (Loi 09-08, Master Spec Partie
 * 5.6 — M13). Syndic/super_admin, compte DESACTIVE requis (422 sinon), Idempotency-Key
 * obligatoire (action probante).
 */
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { withApiHandler } from "../../../../../lib/http/handler";
import {
  anonymiserUtilisateur,
  ContrainteMetierError,
} from "../../../../../lib/users/anonymisation";
import {
  PermissionRefuseeError,
  UtilisateurIntrouvableError,
} from "../../../../../lib/users/users";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    // L'anonymisation est déjà idempotente par nature (statut ANONYMISE → no-op) : la clé
    // est exigée par le contrat (action probante) et validée, sans table de rejeu dédiée.
    readIdempotencyKey(req);
    return ok(await anonymiserUtilisateur(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof UtilisateurIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
