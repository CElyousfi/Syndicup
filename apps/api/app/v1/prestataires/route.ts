/**
 * GET/POST /v1/prestataires — annuaire prestataires (ajout nécessaire au-delà du tableau Master
 * Spec littéral — voir apps/api/lib/auth/permissions.ts "prestataires.gerer" — M7).
 */
import { withApiHandler } from "../../../lib/http/handler";
import { prestataireCreateSchema } from "../../../lib/incidents/schemas";
import {
  creerPrestataire,
  listerPrestataires,
  PermissionRefuseeError,
} from "../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerPrestataires(ctx);
    return ok(rows);
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
    const parsed = prestataireCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const prestataire = await creerPrestataire(ctx, parsed.data);
    return ok(prestataire, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
