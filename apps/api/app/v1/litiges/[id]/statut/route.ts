/**
 * PATCH /v1/litiges/:id/statut — clôture RESOLU/CLOS avec motif (ajout nécessaire, Doc A §12.1
 * "Explication syndic suffit souvent" — M11). Rôle autorisé — syndic.
 */
import { litigeResoudreSchema } from "../../../../../lib/litiges/schemas";
import {
  resoudreLitige,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/litiges/litiges";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = litigeResoudreSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const litige = await resoudreLitige(ctx, id, parsed.data);
    return ok(litige);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
