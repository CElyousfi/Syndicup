/**
 * POST /v1/auth/password/reset — pose le nouveau mot de passe à partir du lien reçu par e-mail
 * (token_hash, type recovery) et ouvre la session : l'utilisateur est connecté dans la foulée.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { motDePasseReinitialiserSchema } from "../../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../../lib/auth/supabase";
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = motDePasseReinitialiserSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const limite = await enforceRateLimit(req, "password-reset", RATE_LIMITS.authAttempt(), parsed.data.token_hash.slice(0, 32));
  if (limite) return limite;

  const { session, userId, error } = await createSupabaseAuth().reinitialiserMotDePasse(
    parsed.data.token_hash,
    parsed.data.mot_de_passe
  );
  if (error || !session) return fail("UNAUTHENTICATED", "Lien invalide ou expiré — redemandez un e-mail.");
  return ok({ ...session, utilisateur_id: userId });
}

export const POST = withApiHandler(handlePOST);
