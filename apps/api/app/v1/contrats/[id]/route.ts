/** GET/PATCH /v1/contrats/{id} — détail (échéancier, documents signés, dépenses, journal) ; modification (syndic). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { modifierContrat, obtenirContrat } from "../../../../lib/contrats/contrats";
import { contratUpdateSchema } from "../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../lib/contrats/http";

type P = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirContrat(ctx, id));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}

async function handlePATCH(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = contratUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierContrat(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
