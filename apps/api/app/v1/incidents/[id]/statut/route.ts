/**
 * PATCH /v1/incidents/:id/statut — changement de statut (Master Spec Partie 4.2 — M7).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { incidentChangerStatutSchema } from "../../../../../lib/incidents/schemas";
import {
  changerStatutIncident,
  PermissionRefuseeError,
  IncidentIntrouvableError,
} from "../../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = incidentChangerStatutSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const log = await changerStatutIncident(ctx, id, parsed.data);
    return ok(log);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IncidentIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const PATCH = withApiHandler(handlePATCH);
