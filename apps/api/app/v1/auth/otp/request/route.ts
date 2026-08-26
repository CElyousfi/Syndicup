/**
 * POST /v1/auth/otp/request — Master Spec Partie 4.3 (flux téléphone par défaut).
 * Rate limit 5/h/numéro (Partie 3.4) : double couche — limiteur applicatif (lib/rate-limit,
 * mémoire par défaut / Upstash env-gated) + config GoTrue ([auth.rate_limit] sms_sent).
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { otpRequestSchema } from "../../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../../lib/auth/supabase";
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const limite = await enforceRateLimit(
    req,
    "otp-request",
    RATE_LIMITS.otpRequest(),
    parsed.data.telephone
  );
  if (limite) return limite;

  const { error } = await createSupabaseAuth().otpRequest(parsed.data.telephone);
  if (error) {
    // GoTrue renvoie le détail (rate limit, signup désactivé…) — on normalise sans le perdre.
    if (/rate/i.test(error)) return fail("RATE_LIMITED", "Trop de demandes OTP — réessayer plus tard.");
    return fail("VALIDATION_ERROR", error);
  }
  return ok({ envoye: true });
}

export const POST = withApiHandler(handlePOST);
