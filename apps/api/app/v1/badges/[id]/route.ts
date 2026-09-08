/** PATCH /v1/badges/{id} — identifiant, caution, notes (syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../lib/parkings/http";
import { badgeUpdateSchema } from "../../../../lib/parkings/schemas";
import { modifierBadge } from "../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = badgeUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierBadge(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const PATCH = withApiHandler(handlePATCH);
