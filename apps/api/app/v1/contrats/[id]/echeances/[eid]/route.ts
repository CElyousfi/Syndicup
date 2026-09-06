/** PATCH /v1/contrats/{id}/echeances/{eid} — statut (REALISEE / ANNULEE / A_VENIR), date, montant. */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../lib/http/respond";
import { modifierEcheance } from "../../../../../../lib/contrats/contrats";
import { echeanceUpdateSchema } from "../../../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../../../lib/contrats/http";

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string; eid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id, eid } = await params;
    const parsed = echeanceUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierEcheance(ctx, id, eid, parsed.data));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const PATCH = withApiHandler(handlePATCH);
