/** POST /v1/finances/justificatifs/:id/valider — syndic : rapprochement fait → paiement(s) VALIDE, quittance, notification PAIEMENT_VALIDE. Probant : Idempotency-Key obligatoire. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { validerJustificatif } from "../../../../../../lib/justificatifs/justificatifs";
import { justificatifValiderSchema } from "../../../../../../lib/justificatifs/schemas";
import { mapErreurJustificatifs } from "../../../../../../lib/justificatifs/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = justificatifValiderSchema.safeParse((await req.json().catch(() => null)) ?? {});
    if (!parsed.success) return failZod(parsed.error);
    return ok(await validerJustificatif(ctx, id, parsed.data, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
