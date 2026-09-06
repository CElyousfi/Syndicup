/** GET/POST /v1/contrats/{id}/echeances — échéancier ; POST : génération idempotente (12 mois) ou échéance manuelle. */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { ajouterEcheance, genererEcheances, listerEcheances } from "../../../../../lib/contrats/contrats";
import { echeanceCreateSchema, echeancesGenererSchema } from "../../../../../lib/contrats/schemas";
import { mapErreurContrats } from "../../../../../lib/contrats/http";

type P = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await listerEcheances(ctx, id));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request, { params }: P) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // { type, date_echeance } = échéance manuelle ; sinon génération automatique ({ horizon_mois? }).
    if (body && typeof body === "object" && "date_echeance" in body) {
      const parsed = echeanceCreateSchema.safeParse(body);
      if (!parsed.success) return failZod(parsed.error);
      return ok(await ajouterEcheance(ctx, id, parsed.data), { status: 201 });
    }
    const parsed = echeancesGenererSchema.safeParse(body ?? {});
    if (!parsed.success) return failZod(parsed.error);
    return ok(await genererEcheances(ctx, id, parsed.data.horizon_mois));
  } catch (e) {
    const m = mapErreurContrats(e);
    if (m) return m;
    throw e;
  }
}
export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
