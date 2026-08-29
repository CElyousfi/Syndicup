/**
 * GET/POST /v1/finances/contestations — liste (scopée par rôle + RLS) et création par un
 * résident concerné (Doc A §3.3 "Cas Particuliers" — M5).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { contestationChargeCreateSchema } from "../../../../lib/finances/schemas";
import {
  creerContestation,
  listerContestations,
  PermissionRefuseeError,
  RessourceIntrouvableError,
} from "../../../../lib/finances/finances";
import { tenantFromRequest, mapAuthError } from "../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handleGET(req: Request) {
  try {
    const ctx = await tenantFromRequest(req);
    const rows = await listerContestations(ctx);
    return ok(rows);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    throw e;
  }
}

async function handlePOST(req: Request) {
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

export const GET = withApiHandler(handleGET);
export const POST = withApiHandler(handlePOST);
