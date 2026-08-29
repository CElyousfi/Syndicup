/**
 * DELETE /v1/documents/:id — supprime un document téléversé (syndic). Les documents générés
 * par la plateforme (PV, quittances) sont refusés en 409 : ils ont une valeur probante.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import {
  supprimerDocument,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/documents/documents";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await supprimerDocument(ctx, id));
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("CONFLICT", e.message);
    throw e;
  }
}

export const DELETE = withApiHandler(handleDELETE);
