/** POST /v1/annonces/{id}/commentaires — commentaire d'un membre (limité en débit ; Doc A §12 modération syndic). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurCommunication } from "../../../../../lib/communication/http";
type P = { params: Promise<{ id: string }> };
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { commentaireCreateSchema } from "../../../../../lib/communication/schemas";
import { commenterAnnonce } from "../../../../../lib/communication/communication";
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const limite = await enforceRateLimit(req, "annonce-commentaire", RATE_LIMITS.commentaire(), ctx.utilisateurId);
    if (limite) return limite;
    const { id } = await params;
    const parsed = commentaireCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await commenterAnnonce(ctx, id, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurCommunication(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
