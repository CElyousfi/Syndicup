/** POST /v1/emplacements/{id}/liberer — fin de l'attribution en cours (date de fin, motif). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { mapErreurParkings } from "../../../../../lib/parkings/http";
import { libererSchema } from "../../../../../lib/parkings/schemas";
import { libererEmplacement } from "../../../../../lib/parkings/parkings";
type P = { params: Promise<{ id: string }> };
async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = libererSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await libererEmplacement(ctx, id, parsed.data));
  } catch (e) { const m = mapErreurParkings(e); if (m) return m; throw e; }
}
export const POST = withApiHandler(handlePOST);
