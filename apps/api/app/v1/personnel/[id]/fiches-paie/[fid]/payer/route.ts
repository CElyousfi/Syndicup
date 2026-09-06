/** POST /v1/personnel/{id}/fiches-paie/{fid}/payer — délègue à POST /depenses/{depense}/payer (méthode, référence, date, preuve) ; la fiche passe PAYEE. Idempotency-Key. */
import { withApiHandler } from "../../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../../../lib/http/respond";
import { readIdempotencyKey } from "../../../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../../../lib/personnel/http";
import { withTenant } from "../../../../../../../lib/tenant/db";
import { payerDepense } from "../../../../../../../lib/depenses/depenses";
import { depensePayerSchema } from "../../../../../../../lib/depenses/schemas";
import { IntrouvableError, RhError } from "../../../../../../../lib/personnel/rh";
import { mapErreurDepenses } from "../../../../../../../lib/depenses/http";
async function handlePOST(req: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req); const { id, fid } = await params;
    const parsed = depensePayerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    const fiche = await withTenant(ctx, (db) => db.fichePaie.findUnique({ where: { id: fid }, select: { personnelId: true, depenseId: true, statut: true } }));
    if (!fiche || fiche.personnelId !== id) throw new IntrouvableError("Fiche de paie introuvable.");
    if (fiche.statut !== "VALIDEE" || !fiche.depenseId) throw new RhError("PAIE_STATUT_INVALIDE", "Seule une fiche VALIDEE (dépense créée) se paie.");
    const depense = await payerDepense(ctx, fiche.depenseId, parsed.data, readIdempotencyKey(req));
    return ok({ fiche_id: fid, depense });
  } catch (e) { const m = mapErreurRh(e) ?? mapErreurDepenses(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
