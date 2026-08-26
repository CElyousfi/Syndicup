/**
 * GET/POST /v1/invitations — émission et liste des invitations (syndic — Partie 5.1/5.3).
 * L'envoi réel email/SMS du code arrive avec M9 (notifications) ; d'ici là le code est retourné
 * dans la réponse et transmis manuellement par le syndic.
 */
import { withApiHandler } from "../../../lib/http/handler";
import { invitationCreateSchema } from "../../../lib/auth/schemas";
import {
  creerInvitation,
  listerInvitations,
  PermissionRefuseeError,
} from "../../../lib/auth/invitations";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const { total, rows } = await listerInvitations(ctx, page, limit);
    return ok(rows, {
      meta: { total, page, has_more: page * limit < total },
    });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = invitationCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const invitation = await creerInvitation(ctx, parsed.data);
    return ok(invitation, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
