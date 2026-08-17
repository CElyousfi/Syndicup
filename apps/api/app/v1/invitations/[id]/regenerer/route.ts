/**
 * POST /v1/invitations/:id/regenerer — régénère un code sans recréer le lot (Partie 5.5).
 */
import {
  regenererInvitation,
  PermissionRefuseeError,
  InvitationIntrouvableError,
  InvitationDejaAccepteeError,
} from "../../../../../lib/auth/invitations";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const nouvelle = await regenererInvitation(ctx, id);
    return ok(nouvelle, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof InvitationIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof InvitationDejaAccepteeError) return fail("CONFLICT", e.message);
    throw e;
  }
}
