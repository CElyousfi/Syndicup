/** POST /v1/lcd/sejours/upload-url — URL signée d'upload d'une pièce jointe de séjour (image ou PDF, jamais une pièce d'identité). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";
import { preparerUploadPieceJointe, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../../lib/lcd/lcd";
import { sejourUploadUrlSchema } from "../../../../../lib/lcd/schemas";

function mapErreur(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof LcdError) return fail(e.code, e.message);
  return null;
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = sejourUploadUrlSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await preparerUploadPieceJointe(ctx, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
