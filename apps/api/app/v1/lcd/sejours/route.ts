/** GET/POST /v1/lcd/sejours — séjours de voyageurs (M15). POST probant : Idempotency-Key obligatoire. */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../lib/http/idempotency";
import { listerSejours, creerSejour, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../lib/lcd/lcd";
import { sejoursFiltresSchema, sejourCreateSchema } from "../../../../lib/lcd/schemas";

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
    const parsed = sejoursFiltresSchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerSejours(ctx, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = sejourCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerSejour(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
