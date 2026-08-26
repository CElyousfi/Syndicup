/**
 * POST /v1/auth/otp/verify — vérifie le code SMS et retourne la session Supabase
 * (JWT avec claim roles via custom_access_token_hook — Master Spec Partie 4.4).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { otpVerifySchema } from "../../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../../lib/auth/supabase";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const { session, userId, error } = await createSupabaseAuth().otpVerify(
    parsed.data.telephone,
    parsed.data.code
  );
  if (error || !session) {
    return fail("UNAUTHENTICATED", error ?? "Code OTP invalide ou expiré.");
  }
  return ok({ ...session, utilisateur_id: userId });
}

export const POST = withApiHandler(handlePOST);
