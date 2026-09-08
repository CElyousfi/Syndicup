/** POST /v1/badges/{id}/perdu — déclaration de perte (résident pour ses lots ou syndic) → notification syndic + tâche M22 « désactiver ». */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../../lib/parkings/http";
import { badgePerduSchema } from "../../../../../lib/parkings/schemas";
import { declarerBadgePerdu } from "../../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = badgePerduSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await declarerBadgePerdu(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
