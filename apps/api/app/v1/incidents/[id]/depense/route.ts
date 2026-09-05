/** POST /v1/incidents/:id/depense — BROUILLON de dépense pré-rempli depuis l'incident (syndic). */
import { withApiHandler } from "../../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../../lib/http/request-context";
import { ok, failZod } from "../../../../../lib/http/respond";
import { creerDepenseDepuisIncident } from "../../../../../lib/depenses/depenses";
import { incidentDepenseCreateSchema } from "../../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../../lib/depenses/http";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = incidentDepenseCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await creerDepenseDepuisIncident(ctx, id, parsed.data), { status: 201 });
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
