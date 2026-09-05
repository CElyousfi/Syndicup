/** GET/PUT /v1/lcd/reglement — régime de location courte durée de la copropriété (M15, Doc A §10.2). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";
import { obtenirReglement, modifierReglement, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../lib/lcd/lcd";
import { reglementLcdUpdateSchema } from "../../../../lib/lcd/schemas";

function mapErreur(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof LcdError) return fail(e.code, e.message);
  return null;
}

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    return ok(await obtenirReglement(ctx));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

async function handlePUT(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = reglementLcdUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierReglement(ctx, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PUT = withApiHandler(handlePUT);
