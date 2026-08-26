/**
 * POST /v1/reservations/:id/rejeter — rejet syndic avec motif (Doc A §7.2, ajout nécessaire — M8).
 */
import { reservationRejeterSchema } from "../../../../../lib/espaces-communs/schemas";
import {
  rejeterReservation,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/espaces-communs/espaces-communs";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = reservationRejeterSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const reservation = await rejeterReservation(ctx, id, parsed.data.motif);
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
