/**
 * GET/POST /v1/coproprietes — M12 (Master Spec Partie 3.2 : super_admin create, syndic manage own).
 * GET : liste multi-copropriétés depuis les claims JWT vérifiés (pas de X-Copropriete-Id requis).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { coproprieteCreateSchema } from "../../../lib/coproprietes/schemas";
import {
  listerCoproprietes,
  creerCopropriete,
  PermissionRefuseeError,
} from "../../../lib/coproprietes/coproprietes";
import { resolveRoleClaims, UnauthenticatedError } from "../../../lib/tenant/jwt";
import { bearerToken, tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const token = bearerToken(req);
    if (!token) throw new UnauthenticatedError("Header Authorization: Bearer manquant.");
    const { utilisateurId, roles } = await resolveRoleClaims(token);
    const coproprietes = await listerCoproprietes(utilisateurId, roles);
    return ok(coproprietes);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = coproprieteCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const copro = await creerCopropriete(ctx, parsed.data);
    return ok(copro, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
