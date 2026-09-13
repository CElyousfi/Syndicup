/**
 * POST /api/auth-send-sms-hook — hook « Send SMS » de GoTrue (supabase/config.toml
 * [auth.hook.send_sms]). Endpoint d'infrastructure (comme /api/health, /api/inngest) : hors
 * app/v1, non authentifié par JWT (authentifié par la signature Standard Webhooks), hors
 * contrat OpenAPI.
 *
 * Env requis pour un envoi réel : SUPABASE_AUTH_HOOK_SEND_SMS_SECRET, INFOBIP_API_KEY,
 * INFOBIP_BASE_URL (+ INFOBIP_SENDER optionnel). Absents → 500 explicite (jamais un 200 simulé :
 * GoTrue considérerait l'OTP comme envoyé alors qu'il ne l'est pas).
 */
import { enforceRateLimit } from "../../../lib/rate-limit/apply";
import { RATE_LIMITS } from "../../../lib/rate-limit";
import {
  verifierSignatureHook,
  extrairePayload,
  messageOtp,
  envoyerSmsInfobip,
  masquerTelephone,
  SignatureInvalideError,
  PayloadInvalideError,
} from "../../../lib/auth/send-sms-hook";
import { logger } from "../../../lib/logging/logger";

export const dynamic = "force-dynamic";

function erreur(statut: number, message: string): Response {
  return Response.json({ error: { http_code: statut, message } }, { status: statut });
}

export async function POST(req: Request): Promise<Response> {
  const limite = await enforceRateLimit(req, "auth-send-sms-hook", RATE_LIMITS.authHookSms());
  if (limite) return erreur(429, "Trop de requêtes.");

  const secret = process.env.SUPABASE_AUTH_HOOK_SEND_SMS_SECRET;
  if (!secret) {
    logger.error("send-sms-hook : SUPABASE_AUTH_HOOK_SEND_SMS_SECRET manquant — hook inutilisable.");
    return erreur(500, "Hook non configuré côté API.");
  }

  const rawBody = await req.text();
  try {
    verifierSignatureHook(rawBody, {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    }, secret);
  } catch (e) {
    if (e instanceof SignatureInvalideError) {
      logger.warn("send-sms-hook : signature invalide — requête rejetée.", { erreur: e.message });
      return erreur(401, e.message);
    }
    throw e;
  }

  let telephone: string, otp: string;
  try {
    const body = JSON.parse(rawBody) as unknown;
    ({ telephone, otp } = extrairePayload(body));
  } catch (e) {
    if (e instanceof PayloadInvalideError || e instanceof SyntaxError) return erreur(400, e.message);
    throw e;
  }

  const apiKey = process.env.INFOBIP_API_KEY;
  const baseUrl = process.env.INFOBIP_BASE_URL;
  if (!apiKey || !baseUrl) {
    logger.error("send-sms-hook : INFOBIP_API_KEY / INFOBIP_BASE_URL manquants — SMS non envoyé.", { destinataire: masquerTelephone(telephone) });
    return erreur(500, "Fournisseur SMS non configuré côté API.");
  }

  const resultat = await envoyerSmsInfobip(telephone, messageOtp(otp), {
    baseUrl,
    apiKey,
    expediteur: process.env.INFOBIP_SENDER || undefined,
  });
  if (!resultat.ok) return erreur(500, resultat.detail ?? "Envoi SMS échoué.");

  return Response.json({});
}
