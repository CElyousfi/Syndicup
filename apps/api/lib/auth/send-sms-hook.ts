/**
 * Hook GoTrue « Send SMS » (Master Spec Partie 4.3, agrégateur SMS — M0 notes de dépendance
 * externe) : GoTrue POST ce webhook à CHAQUE OTP téléphone non couvert par `[auth.sms.test_otp]`
 * (supabase/config.toml) au lieu de tenter un envoi via un provider "natif" (Twilio…) — on
 * envoie nous-mêmes le SMS via Infobip, avec le code exact que GoTrue a déjà généré et stocké.
 *
 * Vérification Standard Webhooks (https://www.standardwebhooks.com) : signature HMAC-SHA256 sur
 * `${id}.${timestamp}.${corps brut}` avec la clé décodée en base64, comparaison à temps constant,
 * fenêtre de fraîcheur anti-rejeu. Secret au format `v1,whsec_<base64>` (supabase/config.toml
 * `[auth.hook.send_sms].secrets`, résolu depuis supabase/.env — jamais commité).
 *
 * ⚠️ Aucune PII en clair dans les logs (CLAUDE.md §5) : le numéro est masqué, le code OTP n'est
 * JAMAIS loggé.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "../logging/logger";

const TOLERANCE_SEC = 5 * 60;

export class SignatureInvalideError extends Error {}
export class PayloadInvalideError extends Error {}

export interface SendSmsHookPayload {
  user: { id: string; phone?: string | null };
  sms: { otp: string };
}

/** Masque un numéro pour les logs : garde les 2 derniers chiffres. */
export function masquerTelephone(tel: string): string {
  return tel.length <= 2 ? "**" : `${"*".repeat(tel.length - 2)}${tel.slice(-2)}`;
}

function decodeSecret(secretConfig: string): Buffer {
  // Format "v1,whsec_<base64>" — plusieurs secrets séparés par espace acceptés (rotation), on ne
  // gère qu'un seul secret actif ici (suffisant : un seul hook, pas de rotation en cours).
  const m = secretConfig.trim().match(/^v1,whsec_([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error("SUPABASE_AUTH_HOOK_SEND_SMS_SECRET : format invalide (attendu v1,whsec_<base64>).");
  return Buffer.from(m[1]!, "base64");
}

/**
 * Vérifie la signature Standard Webhooks d'une requête GoTrue. `rawBody` DOIT être le corps
 * brut exact reçu (jamais re-sérialisé) : la signature porte sur les octets exacts envoyés.
 */
export function verifierSignatureHook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secretConfig: string,
  maintenant: number = Date.now()
): void {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) throw new SignatureInvalideError("En-têtes webhook-id/webhook-timestamp/webhook-signature manquants.");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(maintenant / 1000 - ts) > TOLERANCE_SEC) {
    throw new SignatureInvalideError("Horodatage du webhook hors fenêtre de fraîcheur (rejeu suspecté).");
  }

  const key = decodeSecret(secretConfig);
  const attendu = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  // webhook-signature peut contenir plusieurs signatures espacées ("v1,<sig1> v1,<sig2>") —
  // rotation de secret ; on accepte si l'une correspond.
  const candidats = signature.split(" ").filter(Boolean);
  const valide = candidats.some((c) => {
    const m = c.match(/^v1,([A-Za-z0-9+/=]+)$/);
    if (!m) return false;
    const fourni = Buffer.from(m[1]!, "base64");
    return fourni.length === attendu.length && timingSafeEqual(fourni, attendu);
  });
  if (!valide) throw new SignatureInvalideError("Signature webhook invalide.");
}

/** Extrait { telephone, otp } du payload GoTrue, valide le strict nécessaire. */
export function extrairePayload(body: unknown): { telephone: string; otp: string } {
  const b = body as Partial<SendSmsHookPayload> | null;
  const otp = b?.sms?.otp;
  const telephone = b?.user?.phone;
  if (typeof otp !== "string" || !/^[0-9]{4,8}$/.test(otp)) throw new PayloadInvalideError("sms.otp manquant ou invalide.");
  if (typeof telephone !== "string" || telephone.length < 6) throw new PayloadInvalideError("user.phone manquant ou invalide.");
  return { telephone, otp };
}

/** Message GSM-7 pur (aucun accent) : un seul segment SMS, facturation minimale, livraison fiable. */
export function messageOtp(otp: string): string {
  return `Code SyndicUp : ${otp}. Ne le partagez avec personne.`;
}

export interface EnvoiSmsResultat {
  ok: boolean;
  detail?: string;
}

/**
 * Envoie le SMS via l'API Infobip (POST /sms/3/messages — Authorization: App <clé>).
 * `baseUrl` sans schéma ni slash final accepté (ex. "y4e81j.api.infobip.com" ou avec https://).
 *
 * `expediteur` (sender) : sur un compte d'essai Infobip, l'expéditeur DOIT être celui assigné
 * par Infobip à ce compte (visible dans le tableau de bord "Send your first message") — un
 * compte d'essai ne peut de toute façon envoyer qu'au numéro vérifié à l'inscription. Sans
 * `expediteur` configuré, la requête est envoyée sans `sender` (Infobip la rejette
 * explicitement plutôt qu'un envoi silencieusement mal formé).
 */
export async function envoyerSmsInfobip(
  telephone: string,
  message: string,
  config: { baseUrl: string; apiKey: string; expediteur?: string },
  fetchImpl: typeof fetch = fetch
): Promise<EnvoiSmsResultat> {
  const base = config.baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const destinataire = telephone.replace(/^\+/, "");
  const message_: Record<string, unknown> = { destinations: [{ to: destinataire }], content: { text: message } };
  if (config.expediteur) message_.sender = config.expediteur;

  try {
    const res = await fetchImpl(`https://${base}/sms/3/messages`, {
      method: "POST",
      headers: {
        Authorization: `App ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ messages: [message_] }),
    });
    const corps = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ status?: { groupName?: string; description?: string } }>;
      requestError?: { serviceException?: { text?: string } };
    };
    if (!res.ok) {
      const detail = corps.requestError?.serviceException?.text ?? `HTTP ${res.status}`;
      logger.warn("Infobip : envoi SMS refusé", { destinataire: masquerTelephone(destinataire), statut_http: res.status, detail });
      return { ok: false, detail };
    }
    const groupe = corps.messages?.[0]?.status?.groupName;
    // Infobip répond 200 même pour certains rejets (numéro invalide…) : le statut du message compte.
    if (groupe && groupe !== "PENDING" && groupe !== "DELIVERED") {
      const detail = corps.messages?.[0]?.status?.description ?? groupe;
      logger.warn("Infobip : SMS non délivrable", { destinataire: masquerTelephone(destinataire), groupe, detail });
      return { ok: false, detail };
    }
    logger.info("Infobip : SMS envoyé", { destinataire: masquerTelephone(destinataire), groupe: groupe ?? "?" });
    return { ok: true };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    logger.error("Infobip : erreur réseau", { destinataire: masquerTelephone(destinataire), erreur: detail });
    return { ok: false, detail };
  }
}
