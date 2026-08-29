/**
 * GET /v1/incidents/:id — détail d'un incident avec son journal append-only (Doc A §5 — M7,
 * page F3 du brief frontend). Confidentialité : RLS + permission scopée comme la liste.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import {
  obtenirIncidentAvecJournal,
  PermissionRefuseeError,
  IncidentIntrouvableError,
} from "../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const incident = await obtenirIncidentAvecJournal(ctx, id);
    return ok(incident);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IncidentIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
