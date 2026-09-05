/** GET/PATCH /v1/lcd/sejours/:id (PATCH : uniquement PREVU, mêmes règles qu'à la création). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";
import { obtenirSejour, modifierSejour, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../../lib/lcd/lcd";
import { sejourUpdateSchema } from "../../../../../lib/lcd/schemas";

function mapErreur(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof LcdError) return fail(e.code, e.message);
  return null;
}

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirSejour(ctx, id));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = sejourUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierSejour(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
