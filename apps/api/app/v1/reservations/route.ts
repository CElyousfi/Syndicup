/**
 * GET/POST /v1/reservations — liste et création de réservations (Doc A §7.2 — M8).
 */
import { reservationCreateSchema } from "../../../lib/espaces-communs/schemas";
import {
  creerReservation,
  listerReservations,
  PermissionRefuseeError,
  IntrouvableError,
  ContrainteMetierError,
} from "../../../lib/espaces-communs/espaces-communs";
import { tenantFromRequest, mapAuthError } from "../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../lib/http/respond";

export async function GET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const url = new URL(req.url);
    const espaceId = url.searchParams.get("espace_id") ?? undefined;
    const rows = await listerReservations(ctx, espaceId);
    return ok(rows);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = reservationCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const reservation = await creerReservation(ctx, parsed.data);
    return ok(reservation, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof IntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}
