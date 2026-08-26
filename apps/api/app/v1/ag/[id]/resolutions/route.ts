/**
 * POST /v1/ag/:id/resolutions — ajout d'une résolution (Master Spec Partie 8 — M6).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { agResolutionCreateSchema } from "../../../../../lib/ag/schemas";
import {
  creerResolution,
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
    const parsed = agResolutionCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const resolution = await creerResolution(ctx, id, parsed.data);
    return ok(resolution, { status: 201 });
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
