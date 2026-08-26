/**
 * POST /v1/auth/otp/verify — vérifie le code SMS et retourne la session Supabase
 * (JWT avec claim roles via custom_access_token_hook — Master Spec Partie 4.4).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { otpVerifySchema } from "../../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../../lib/auth/supabase";
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  // Anti force-brute sur le code à 6 chiffres : limite par numéro ciblé.
  const limite = await enforceRateLimit(
    req,
    "otp-verify",
    RATE_LIMITS.authAttempt(),
    parsed.data.telephone
  );
  if (limite) return limite;

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
