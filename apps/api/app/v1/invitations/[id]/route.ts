/**
 * DELETE /v1/invitations/:id — annule une invitation EN_ATTENTE (le code cesse de fonctionner,
 * la trace reste). Rôle autorisé — syndic ; super_admin pour une invitation SYNDIC.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import {
  annulerInvitation,
  PermissionRefuseeError,
  InvitationIntrouvableError,
  InvitationDejaAccepteeError,
} from "../../../../lib/auth/invitations";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await annulerInvitation(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof InvitationIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof InvitationDejaAccepteeError) return fail("CONFLICT", e.message);
    throw e;
  }
}

export const DELETE = withApiHandler(handleDELETE);
