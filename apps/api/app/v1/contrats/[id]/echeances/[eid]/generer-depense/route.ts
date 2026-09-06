/** POST /v1/contrats/{id}/echeances/{eid}/generer-depense — dépense BROUILLON liée au contrat (Idempotency-Key). */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../../lib/http/idempotency";
import { genererDepenseDepuisEcheance } from "../../../../../../../lib/contrats/contrats";
import { genererDepenseSchema } from "../../../../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../../../../lib/contrats/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string; eid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, eid } = await params;
    const parsed = genererDepenseSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await genererDepenseDepuisEcheance(ctx, id, eid, parsed.data, readIdempotencyKey(req)), { status: 201 });
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const POST = withApiHandler(handlePOST);
