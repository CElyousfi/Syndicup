/**
 * GET/PATCH /v1/users/me — profil de l'appelant (droit d'accès et de rectification CNDP,
 * Master Spec Partie 10.1 — M13).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { profilUpdateSchema } from "../../../../lib/users/schemas";
import {
  obtenirMonProfil,
  modifierMonProfil,
  UtilisateurIntrouvableError,
} from "../../../../lib/users/users";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await obtenirMonProfil(ctx));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof UtilisateurIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

async function handlePATCH(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = profilUpdateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierMonProfil(ctx, parsed.data));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof UtilisateurIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
