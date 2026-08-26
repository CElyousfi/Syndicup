/**
 * PATCH /v1/personnel/:id/statut — présence/logement du gardien (Doc A §9.2 — M10).
 */
import { personnelChangerStatutSchema } from "../../../../../lib/personnel/schemas";
import {
  changerStatutPersonnel,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/personnel/personnel";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = personnelChangerStatutSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const fiche = await changerStatutPersonnel(ctx, id, parsed.data);
    return ok(fiche);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
