/**
 * GET /v1/auth/invite/:code — aperçu public d'une invitation : copropriété, rôle visé,
 * expiration, état (EN_ATTENTE / ACCEPTEE / EXPIREE / INVALIDE). Aucune donnée personnelle.
 * Sert l'écran d'inscription (« Rejoindre Résidence X en tant que syndic »). Limité par code.
 */
import { withApiHandler } from "../../../../../lib/http/handler";
import { apercuInvitation } from "../../../../../lib/auth/invitations";
import { enforceRateLimit } from "../../../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../../../lib/rate-limit";
import { ok, fail } from "../../../../../lib/http/respond";

async function handleGET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalise = decodeURIComponent(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(normalise)) return fail("NOT_FOUND", "Code invalide.");

  const limite = await enforceRateLimit(req, "invite-apercu", RATE_LIMITS.authAttempt(), normalise);
  if (limite) return limite;

  // Jeton d'ouverture de l'appareil (usage unique — M17) : lie le code au premier lecteur.
  const jeton = new URL(req.url).searchParams.get("jeton");
  return ok(await apercuInvitation(normalise, jeton));
}

export const GET = withApiHandler(handleGET);
