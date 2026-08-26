/**
 * POST /v1/auth/refresh — échange un refresh_token contre une nouvelle session.
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { refreshSchema } from "../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../lib/auth/supabase";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const { session, error } = await createSupabaseAuth().refresh(parsed.data.refresh_token);
  if (error || !session) {
    return fail("UNAUTHENTICATED", "Refresh token invalide ou expiré.");
  }
  return ok(session);
}

export const POST = withApiHandler(handlePOST);
