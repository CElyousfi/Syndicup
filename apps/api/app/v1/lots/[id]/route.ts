/**
 * GET/PATCH /v1/lots/:id — consultation et modification d'un lot (Master Spec Partie 2.2 — M3).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { lotUpdateSchema } from "../../../../lib/lots/schemas";
import {
  obtenirLot,
  modifierLot,
  PermissionRefuseeError,
  LotIntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/lots/lots";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const lot = await obtenirLot(ctx, id);
    return ok(lot);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof LotIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = lotUpdateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const lot = await modifierLot(ctx, id, parsed.data);
    return ok(lot);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof LotIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
