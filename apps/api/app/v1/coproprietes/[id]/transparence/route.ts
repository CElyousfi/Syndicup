/** PATCH /v1/coproprietes/{id}/transparence — visibilité des factures pour les résidents (syndic, audité). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { definirFacturesVisibles } from "../../../../../lib/rapports/transparence";
import { facturesVisiblesSchema } from "../../../../../lib/rapports/schemas";
import { mapErreurRapports } from "../../../../../lib/rapports/http";

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = facturesVisiblesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await definirFacturesVisibles(ctx, id, parsed.data.factures_visibles_residents));
  } catch (e) {
    const m = mapErreurRapports(e);
    if (m) return m;
    throw e;
  }
}
export const PATCH = withApiHandler(handlePATCH);
