/**
 * POST /v1/personnel/conges/{cid}/annuler — annulation (employé pour sa demande, syndic).
 * Idempotency-Key OPTIONNELLE (la Server Action web ne l'envoie pas encore ; le mobile oui) :
 * présente → rejeu à l'identique / 409 si payload différent.
 */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../../lib/http/request-context";
import { ok } from "../../../../../../lib/http/respond";
import { readIdempotencyKeyOptionnelle } from "../../../../../../lib/http/idempotency";
import { mapErreurRh } from "../../../../../../lib/personnel/http";
import { annulerConge } from "../../../../../../lib/personnel/rh";
async function handlePOST(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  try {
    const ctx = await tenantFromRequest(req); const { cid } = await params;
    return ok(await annulerConge(ctx, cid, readIdempotencyKeyOptionnelle(req)));
  } catch (e) { const m = mapErreurRh(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
