/** POST /v1/lcd/declarations/:id/cloturer — fin de l'activité LCD sur le lot (409 si séjour prévu/en cours). */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../../lib/http/respond";
import { cloturerDeclaration, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../../../lib/lcd/lcd";
import { declarationLcdClotureSchema } from "../../../../../../lib/lcd/schemas";

function mapErreur(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof LcdError) return fail(e.code, e.message);
  return null;
}

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = declarationLcdClotureSchema.safeParse((await req.json().catch(() => null)) ?? {});
    if (!parsed.success) return failZod(parsed.error);
    return ok(await cloturerDeclaration(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
