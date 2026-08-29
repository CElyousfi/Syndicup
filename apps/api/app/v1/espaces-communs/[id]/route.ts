/**
 * PATCH/DELETE /v1/espaces-communs/:id — modification et suppression d'un espace commun
 * (syndic). La suppression est refusée (409) si des réservations existent : passer l'espace
 * en non réservable est alors la bonne action.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { espaceCommunUpdateSchema } from "../../../../lib/espaces-communs/schemas";
import {
  modifierEspaceCommun,
  supprimerEspaceCommun,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/espaces-communs/espaces-communs";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

function mapErreur(e: unknown) {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof ContrainteMetierError) return fail("CONFLICT", e.message);
  throw e;
}

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = espaceCommunUpdateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierEspaceCommun(ctx, id, parsed.data));
  } catch (e) {
    return mapErreur(e);
  }
}

async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await supprimerEspaceCommun(ctx, id));
  } catch (e) {
    return mapErreur(e);
  }
}

export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
