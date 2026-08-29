/**
 * POST /v1/auth/invite/inscription — inscription par invitation (scan du QR ou code) :
 * l'invité crée son compte (email + mot de passe + identité) et rejoint sa copropriété dans
 * le même geste. Code à usage unique, vérifié AVANT toute création. Public, limité par email.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { inviteInscriptionSchema } from "../../../../../lib/auth/schemas";
import { inscrireParInvitation } from "../../../../../lib/auth/invitations";
import { createSupabaseAuth, createSupabaseAdmin } from "../../../../../lib/auth/supabase";
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = inviteInscriptionSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const limite = await enforceRateLimit(
    req,
    "invite-inscription",
    RATE_LIMITS.authAttempt(),
    parsed.data.email.toLowerCase()
  );
  if (limite) return limite;

  const resultat = await inscrireParInvitation(parsed.data, {
    auth: createSupabaseAuth(),
    admin: createSupabaseAdmin(),
  });

  switch (resultat.statut) {
    case "OK":
      return ok(
        {
          ...resultat.session,
          copropriete_id: resultat.copropriete_id,
          role: resultat.role,
          statut_compte: resultat.statut_compte,
        },
        { status: 201 }
      );
    case "INVALIDE":
    case "EXPIREE":
      return fail("NOT_FOUND", "Code invalide ou expiré.");
    case "DEJA_UTILISEE":
      return fail("CONFLICT", "Cette invitation a déjà été utilisée.");
    case "EMAIL_DEJA_INSCRIT":
    case "EMAIL_DEJA_UTILISE":
      return fail("CONFLICT", "Un compte existe déjà avec cet email — connectez-vous.");
    case "TELEPHONE_DEJA_UTILISE":
      return fail("CONFLICT", "Téléphone déjà utilisé par un autre compte — contacter le syndic.");
    case "CONFLIT_SYNDIC":
      return fail("CONFLICT", "Un syndic actif existe déjà pour cette copropriété (Partie 2.4).");
  }
}

export const POST = withApiHandler(handlePOST);
