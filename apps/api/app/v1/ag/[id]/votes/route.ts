/**
 * POST /v1/ag/:id/votes — enregistre un vote, écriture synchrone (Master Spec Partie 8.7 — M6).
 */
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { readIdempotencyKey } from "../../../../../lib/http/idempotency";
import { withApiHandler } from "../../../../../lib/http/handler";
import { agVoteCreateSchema } from "../../../../../lib/ag/schemas";
import {
  voter,
  PermissionRefuseeError,
  AgIntrouvableError,
  ContrainteMetierError,
} from "../../../../../lib/ag/ag";
import { tenantFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await tenantFromRequest(req);
    const limite = await enforceRateLimit(req, "ag-vote", RATE_LIMITS.ecritureFinanciere(), ctx.utilisateurId);
    if (limite) return limite;
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = agVoteCreateSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);
    const vote = await voter(ctx, id, parsed.data, readIdempotencyKey(req));
    return ok(vote, { status: 201 });
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    if (e instanceof PermissionRefuseeError) return fail("FORBIDDEN", e.message);
    if (e instanceof AgIntrouvableError) return fail("NOT_FOUND", e.message);
    if (e instanceof ContrainteMetierError) return fail("UNPROCESSABLE_ENTITY", e.message);
    throw e;
  }
}

export const POST = withApiHandler(handlePOST);
