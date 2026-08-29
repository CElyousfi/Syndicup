/**
 * PATCH/DELETE /v1/prestataires/:id — fiche prestataire (syndic). Suppression refusée (409)
 * s'il a des interventions dans l'historique : le désactiver (actif=false) est alors la voie.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { prestataireUpdateSchema } from "../../../../lib/incidents/schemas";
import {
  modifierPrestataire,
  supprimerPrestataire,
  PermissionRefuseeError,
  PrestataireIntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/incidents/incidents";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

function mapErreur(e: unknown) {
  const mapped = mapAuthError(e);
  if (mapped) return mapped;
  if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
  if (e instanceof PrestataireIntrouvableError) return fail("NOT_FOUND", e.message);
  if (e instanceof ContrainteMetierError) return fail("CONFLICT", e.message);
  throw e;
}

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = prestataireUpdateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    return ok(await modifierPrestataire(ctx, id, parsed.data));
  } catch (e) {
    return mapErreur(e);
  }
}

async function handleDELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    return ok(await supprimerPrestataire(ctx, id));
  } catch (e) {
    return mapErreur(e);
  }
}

export const PATCH = withApiHandler(handlePATCH);
export const DELETE = withApiHandler(handleDELETE);
