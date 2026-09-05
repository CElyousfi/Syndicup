/** POST /v1/finances/paiements/especes — espèces reçues : gardien → justificatif EN_ATTENTE ; syndic → paiement VALIDE. Idempotency-Key. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { saisirEspeces } from "../../../../../lib/justificatifs/justificatifs";
import { paiementEspecesSchema } from "../../../../../lib/justificatifs/schemas";
import { mapErreurJustificatifs } from "../../../../../lib/justificatifs/http";

async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = paiementEspecesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await saisirEspeces(ctx, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) {
    const m = mapErreurJustificatifs(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
