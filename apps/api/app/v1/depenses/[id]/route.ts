/** GET/PATCH /v1/depenses/:id — détail (factures, journal, preuve) et modification (BROUILLON / REJETEE). */
import { withApiHandler } from "../../../../lib/http/handler";
import { tenantFromRequest } from "../../../../lib/http/request-context";
import { ok, failZod } from "../../../../lib/http/respond";
import { obtenirDepense, modifierDepense } from "../../../../lib/depenses/depenses";
import { depenseUpdateSchema } from "../../../../lib/depenses/schemas";
import { mapErreurDepenses } from "../../../../lib/depenses/http";

type RouteCtx = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await obtenirDepense(ctx, id));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

async function handlePATCH(req: Request, { params }: RouteCtx) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = depenseUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierDepense(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreurDepenses(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const PATCH = withApiHandler(handlePATCH);
