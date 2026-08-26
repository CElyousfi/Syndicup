/**
 * POST /v1/finances/contestations — contestation d'une ligne de charge par un résident
 * (Doc A §3.3 "Cas Particuliers" — M5).
 */
import { contestationChargeCreateSchema } from "../../../../lib/finances/schemas";
import {
  creerContestation,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

export async function POST(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = contestationChargeCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const contestation = await creerContestation(ctx, parsed.data);
    return ok(contestation, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}
