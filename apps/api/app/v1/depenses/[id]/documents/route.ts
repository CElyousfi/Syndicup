/** GET /v1/depenses/:id/documents — URLs signées 15 min des factures et de la preuve de paiement. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok } from "../../../../../lib/http/respond";
import { documentsDepense } from "../../../../../lib/depenses/depenses";
import { mapErreurDepenses } from "../../../../../lib/depenses/http";

async function handleGET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await documentsDepense(ctx, id));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
