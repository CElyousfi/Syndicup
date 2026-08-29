/**
 * GET /v1/incidents/:id/photos — URLs signées (15 min) des photos du signalement.
 * Accès : mêmes règles que le détail de l'incident (permission + RLS avant le storage).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import {
  urlsPhotosIncident,
  IncidentIntrouvableError,
  PermissionRefuseeError,
} from "../../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const photos = await urlsPhotosIncident(ctx, id);
    return ok(photos);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IncidentIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
