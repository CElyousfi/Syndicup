/**
 * POST /v1/auth/password/forgot — « mot de passe oublié ».
 * Réponse identique que l'e-mail existe ou non (aucune énumération de comptes) ; GoTrue
 * envoie le lien de réinitialisation vers NEXT_PUBLIC_APP_URL/{langue}/reinitialiser.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { motDePasseOublieSchema } from "../../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../../lib/auth/supabase";
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { ok, failZod } from "../../../../../lib/http/respond";
import { logger } from "../../../../../lib/logging/logger";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = motDePasseOublieSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const email = parsed.data.email.toLowerCase();
  const limite = await enforceRateLimit(req, "password-forgot", RATE_LIMITS.motDePasseOublie(), email);
  if (limite) return limite;

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.syndicup.pro").replace(/\/$/, "");
  const redirectTo = `${base}/${parsed.data.langue}/reinitialiser`;
  const { error } = await createSupabaseAuth().demanderReinitialisation(email, redirectTo);
  if (error) {
    // Jamais remonté au client (énumération) ; tracé pour l'exploitation.
    logger.warn("Réinitialisation : GoTrue a refusé l'envoi", { raison: error });
  }
  return ok({ envoye: true });
}

export const POST = withApiHandler(handlePOST);
