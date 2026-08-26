/**
 * POST /v1/finances/contestations/:id/reponse — réponse du syndic à une contestation
 * (Doc A §3.3 "Cas Particuliers" — M5).
 */
import { contestationChargeRepondreSchema } from "../../../../../../lib/finances/schemas";
import {
  repondreContestation,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../../lib/http/respond";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = contestationChargeRepondreSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const contestation = await repondreContestation(ctx, id, parsed.data);
    return ok(contestation);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof RessourceIntrouvableError) return fail("NOT_FOUND", e.message);
    throw e;
  }
}
