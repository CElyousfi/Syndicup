/**
 * POST /v1/auth/login — email + mot de passe (option MRE/syndic — Master Spec Partie 4.3).
 */
import { withApiHandler } from "../../../../lib/http/handler";
import { loginSchema } from "../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../lib/auth/supabase";
import { enforceRateLimit } from "../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../lib/rate-limit";
import { ok, fail, failZod } from "../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  // Anti force-brute : limite par email ciblé (et non par IP seule — NAT partagés fréquents).
  const limite = await enforceRateLimit(
    req,
    "login",
    RATE_LIMITS.authAttempt(),
    parsed.data.email.toLowerCase()
  );
  if (limite) return limite;

  const { session, userId, error } = await createSupabaseAuth().loginEmail(
    parsed.data.email,
    parsed.data.mot_de_passe
  );
  if (error || !session) {
    return fail("UNAUTHENTICATED", "Identifiants invalides.");
  }
  return ok({ ...session, utilisateur_id: userId });
}

export const POST = withApiHandler(handlePOST);
