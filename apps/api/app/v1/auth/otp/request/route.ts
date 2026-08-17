/**
 * POST /v1/auth/otp/request — Master Spec Partie 4.3 (flux téléphone par défaut).
 * Rate limit 5/h/numéro (Partie 3.4) : appliqué par la config GoTrue ([auth.rate_limit]
 * sms_sent) — un rate limiter applicatif Upstash/Redis viendra en plus au moment du choix
 * d'infra (pas de dépendance ajoutée sans décision — ROADMAP).
 */
import { otpRequestSchema } from "../../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../../lib/auth/supabase";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const { error } = await createSupabaseAuth().otpRequest(parsed.data.telephone);
  if (error) {
    // GoTrue renvoie le détail (rate limit, signup désactivé…) — on normalise sans le perdre.
    if (/rate/i.test(error)) return fail("RATE_LIMITED", "Trop de demandes OTP — réessayer plus tard.");
    return fail("VALIDATION_ERROR", error);
  }
  return ok({ envoye: true });
}
