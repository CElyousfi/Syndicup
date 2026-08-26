/**
 * POST /v1/auth/invite/accept — Master Spec Partie 4.3.3 / 5.3 / 5.5.
 * L'appelant est authentifié Supabase (OTP vérifié ou email confirmé) mais n'a pas encore de
 * rôle : le code d'invitation détermine copropriété + lot + rôle (jamais choisis par l'invité).
 * Edge cases 5.5 → codes normalisés : 404 invalide/expiré, 409 déjà utilisé / email dupliqué.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { inviteAcceptSchema } from "../../../../../lib/auth/schemas";
import { accepterInvitation } from "../../../../../lib/auth/invitations";
import { identiteFromRequest, mapAuthError } from "../../../../../lib/http/request-context";
import { ok, fail, failZod } from "../../../../../lib/http/respond";

async function handlePOST(req: Request) {
  let identite;
  try {
    identite = await identiteFromRequest(req);
  } catch (e) {
    const mapped = mapAuthError(e);
    if (mapped) return mapped;
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteAcceptSchema.safeParse(body);
  if (!parsed.success) return failZod(parsed.error);

  const resultat = await accepterInvitation(
    {
      utilisateurId: identite.utilisateurId,
      email: identite.email,
      telephone: identite.telephone,
      identiteVerifiee: identite.verifie,
    },
    parsed.data.code
  );

  switch (resultat.statut) {
    case "OK":
      return ok({
        copropriete_id: resultat.copropriete_id,
        lot_id: resultat.lot_id,
        role: resultat.role,
        statut_compte: resultat.statut_compte,
      });
    case "INVALIDE":
    case "EXPIREE":
      // Contrat OpenAPI : 404 "Code invalide ou expiré". L'invitation expirée est régénérable
      // par le syndic (POST /invitations/:id/regenerer — Partie 5.5).
      return fail("NOT_FOUND", "Code invalide ou expiré.");
    case "DEJA_UTILISEE":
      return fail("CONFLICT", "Déjà inscrit — connectez-vous (Partie 5.5).");
    case "EMAIL_DEJA_UTILISE":
      return fail(
        "CONFLICT",
        "Email déjà utilisé par un autre compte — contacter le syndic pour fusion (Partie 5.5)."
      );
    case "TELEPHONE_DEJA_UTILISE":
      return fail(
        "CONFLICT",
        "Téléphone déjà utilisé par un autre compte — contacter le syndic (Partie 5.5)."
      );
    case "CONFLIT_SYNDIC":
      return fail("CONFLICT", "Un syndic actif existe déjà pour cette copropriété (Partie 2.4).");
  }
}

export const POST = withApiHandler(handlePOST);
