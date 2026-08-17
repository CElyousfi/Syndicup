/**
 * POST /v1/auth/login — email + mot de passe (option MRE/syndic — Master Spec Partie 4.3).
 */
import { loginSchema } from "../../../../lib/auth/schemas";
import { createSupabaseAuth } from "../../../../lib/auth/supabase";
import { ok, fail, failZod } from "../../../../lib/http/respond";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const { session, userId, error } = await createSupabaseAuth().loginEmail(
    parsed.data.email,
    parsed.data.mot_de_passe
  );
  if (error || !session) {
    return fail("UNAUTHENTICATED", "Identifiants invalides.");
  }
  return ok({ ...session, utilisateur_id: userId });
}
