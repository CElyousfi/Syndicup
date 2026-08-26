/**
 * PATCH /v1/visites/:id/statut — le résident autorise/refuse, le gardien est notifié
 * (Doc A §9.2 — M10).
 */
import { visiteChangerStatutSchema } from "../../../../../lib/personnel/schemas";
import {
  changerStatutVisite,
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
    const parsed = visiteChangerStatutSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const visite = await changerStatutVisite(ctx, id, parsed.data);
    return ok(visite);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
