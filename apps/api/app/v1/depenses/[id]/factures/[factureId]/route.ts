/** PATCH /v1/depenses/:id/factures/:factureId — statut de la facture (RECUE / VERIFIEE / CONTESTEE / REGLEE) — syndic. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { modifierStatutFacture } from "../../../../../../lib/depenses/depenses";
import { factureUpdateSchema } from "../../../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../../../lib/depenses/http";

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string; factureId: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, factureId } = await params;
    const parsed = factureUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierStatutFacture(ctx, id, factureId, parsed.data));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const PATCH = withApiHandler(handlePATCH);
