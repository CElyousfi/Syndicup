/** POST /v1/rapports/gestion/{id}/soumettre-ag — résolution « approbation des comptes » via le service AG (Idempotency-Key). */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../lib/http/idempotency";
import { soumettreRapportAg } from "../../../../../../lib/rapports/gestion";
import { rapportSoumettreAgSchema } from "../../../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../../../lib/rapports/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = rapportSoumettreAgSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await soumettreRapportAg(ctx, id, parsed.data, readIdempotencyKey(req)));
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
