/**
 * PATCH /v1/reservations/:id — annulation (Master Spec Partie 3.2 — M8). Seule transition
 * supportée par cet endpoint littéral ; validation/rejet syndic sont des ajouts nécessaires
 * séparés (voir ./valider, ./rejeter).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import {
  annulerReservation,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../../lib/espaces-communs/espaces-communs";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail } from "../../../../lib/http/respond";

async function handlePATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const reservation = await annulerReservation(ctx, id);
    return ok(reservation);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const PATCH = withApiHandler(handlePATCH);
