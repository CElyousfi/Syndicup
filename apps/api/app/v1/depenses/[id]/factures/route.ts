/** POST /v1/depenses/:id/factures — ajoute une facture (Document FACTURE) à la dépense — syndic, Idempotency-Key. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { ajouterFacture } from "../../../../../lib/depenses/depenses";
import { factureCreateSchema } from "../../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../../lib/depenses/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = factureCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await ajouterFacture(ctx, id, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
