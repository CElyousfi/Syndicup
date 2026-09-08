/** GET/POST /v1/badges — registre des badges / télécommandes / clés (résident : ses lots via RLS) ; remise avec caution (paiement M17). */
import { withApiHandler } from "../../../lib/http/handler";
import { tenantFromRequest } from "../../../lib/http/request-context";
import { ok, failZod } from "../../../lib/http/respond";
import { mapErreurParkings } from "../../../lib/parkings/http";
import { badgeCreateSchema, badgesFiltresSchema } from "../../../lib/parkings/schemas";
import { creerBadge, listerBadges } from "../../../lib/parkings/parkings";
async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = badgesFiltresSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await listerBadges(ctx, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
async function handlePOST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const parsed = badgeCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerBadge(ctx, parsed.data), { status: 201 });
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
