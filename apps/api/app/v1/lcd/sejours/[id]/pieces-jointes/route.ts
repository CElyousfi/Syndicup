/** GET/POST/DELETE /v1/lcd/sejours/:id/pieces-jointes — pièces jointes d'un séjour (URLs signées 15 min, ajout, retrait). */
import { withApiHandler } from "../../../../../../lib/http/handler";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../../lib/http/respond";
import { urlsPiecesJointes, ajouterPiecesJointes, retirerPieceJointe, PermissionRefuseeError, IntrouvableError, LcdError } from "../../../../../../lib/lcd/lcd";
import { sejourPiecesJointesSchema, sejourPieceJointeSupprimerSchema } from "../../../../../../lib/lcd/schemas";

function mapErreur(e: unknown): Response | null {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof LcdError) return fail(e.code, e.message);
  return null;
}

type Params = { params: Promise<{ id: string }> };

async function handleGET(req: Request, { params }: Params) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await urlsPiecesJointes(ctx, id));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

async function handlePOST(req: Request, { params }: Params) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = sejourPiecesJointesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await ajouterPiecesJointes(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

async function handleDELETE(req: Request, { params }: Params) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const parsed = sejourPieceJointeSupprimerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return failZod(parsed.error);
    return ok(await retirerPieceJointe(ctx, id, parsed.data));
  } catch (e) {
    const m = mapErreur(e);
    if (m) return m;
    throw e;
  }
}

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
export const DELETE = withApiHandler(handleDELETE);
