/**
 * POST /v1/ag/:id/procurations — vote par mandataire (Doc A §6.5 — M6, ajout nécessaire).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { agProcurationCreateSchema } from "../../../../../lib/ag/schemas";
import {
  creerProcuration,
  PermissionRefuseeError,
  AgIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = agProcurationCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const procuration = await creerProcuration(ctx, id, parsed.data);
    return ok(procuration, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
