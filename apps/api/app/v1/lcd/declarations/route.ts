/** GET/POST /v1/lcd/declarations — déclarations « lot exploité en location courte durée » (M15). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";
import { listerDeclarations, creerDeclaration, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../lib/lcd/lcd";
import { declarationsFiltresSchema, declarationLcdCreateSchema } from "../../../../lib/lcd/schemas";

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
    const url = new URL(req.url);
    const parsed = declarationsFiltresSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerDeclarations(ctx, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = declarationLcdCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerDeclaration(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
