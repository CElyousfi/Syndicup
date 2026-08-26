/**
 * POST /v1/incidents/:id/assign — assignation à un prestataire (Master Spec Partie 4.2 — M7).
 */
import { incidentAssignerSchema } from "../../../../../lib/incidents/schemas";
import {
  assignerIncident,
  PermissionRefuseeError,
  IncidentIntrouvableError,
  PrestataireIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = incidentAssignerSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const incident = await assignerIncident(ctx, id, parsed.data.prestataire_id);
    return ok(incident);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IncidentIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof PrestataireIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
