/**
 * GET/PATCH /v1/coproprietes/:id — détail et configuration (syndic sur SA copropriété) — M12.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { coproprieteUpdateSchema } from "../../../../lib/coproprietes/schemas";
import {
  obtenirCopropriete,
  modifierCopropriete,
  PermissionRefuseeError,
  CoproprieteIntrouvableError,
} from "../../../../lib/coproprietes/coproprietes";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

type RouteCtx = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirCopropriete(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof CoproprieteIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

async function handlePATCH(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = coproprieteUpdateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierCopropriete(ctx, id, parsed.data));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof CoproprieteIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
