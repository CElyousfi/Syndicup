/** POST /v1/badges/{id}/restituer — restitution (caution rendue ou non, tracée en audit). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../../lib/parkings/http";
import { badgeRestituerSchema } from "../../../../../lib/parkings/schemas";
import { restituerBadge } from "../../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = badgeRestituerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await restituerBadge(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
