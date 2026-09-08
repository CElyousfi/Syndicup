/** POST /v1/annonces/{id}/publier — publication (immédiate ou programmée), fan-out notifications ; Idempotency-Key. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { annoncePublierSchema } from "../../../../../lib/communication/schemas";
import { publierAnnonce } from "../../../../../lib/communication/communication";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = annoncePublierSchema.safeParse((await req.json().catch(() => ({}))) ?? {});
    if (!parsed.success) return failZod(parsed.error);
    return ok(await publierAnnonce(ctx, id, parsed.data, readIdempotencyKey(req)));
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
