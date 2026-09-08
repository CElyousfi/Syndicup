/**
 * Transport PUSH — Firebase Cloud Messaging, API HTTP v1 (Master Spec Partie 13.4).
 * Activé par FCM_SERVICE_ACCOUNT_JSON (JSON du service account, secret unique — .env.example).
 * Authentification OAuth2 « service account » : JWT RS256 signé localement (jose) échangé
 * contre un access token (mis en cache jusqu'à expiration). Un message par appareil du
 * destinataire (jetons enregistrés via POST /users/me/appareils — M19).
 *
 * Statut honnête : ENVOYE si au moins un appareil a accepté le message, EN_ATTENTE si le
 * destinataire n'a aucun appareil enregistré (rien à envoyer, la notification reste visible
 * in-app), ECHOUE si tous les envois ont échoué. Les jetons UNREGISTERED / INVALID_ARGUMENT
 * sont remontés pour suppression.
 */
import { importPKCS8, SignJWT } from "jose";
import type { MessageNotification, NotificationTransport, ResultatEnvoi } from "./types";
import { logger } from "../../logging/logger";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export function parseServiceAccount(json: string): ServiceAccount {
  const sa = JSON.parse(json) as Partial<ServiceAccount>;
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON incomplet (project_id, client_email, private_key requis).");
  }
  return sa as ServiceAccount;
}

/** Fetch injectable (tests) — global par défaut. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Corps FCM v1 pour un appareil — bannières, alertes, écran verrouillé, badge, fils, actions :
 *  - Android : canal par niveau (créé côté app), `notification_priority`, `visibility: PUBLIC`
 *    (contenu visible sur l'écran verrouillé), `notification_count` (badge), `tag` (remplacement),
 *    `click_action` FLUTTER_NOTIFICATION_CLICK ; en silencieux : données seules, priorité normale.
 *  - iOS (APNs) : `alert` + `sound` + `badge` + `interruption-level` + `thread-id` + `category`
 *    (actions Ouvrir / Marquer comme lu) ; `apns-priority` 10 (immédiat) sauf silencieux (5,
 *    `content-available`, push-type background).
 * Exporté pour les tests.
 */
export function construireMessageFcm(token: string, message: MessageNotification): Record<string, unknown> {
  const push = message.push;
  const donnees: Record<string, string> = {
    ...(message.donnees ?? {}),
    template_code: message.templateCode ?? "",
    titre: message.titre,
    corps: message.corps,
    niveau: push?.niveau ?? "NORMAL",
    canal_android: push?.canalAndroid ?? "syndicup",
    fil: push?.fil ?? "general",
    badge: String(push?.badge ?? 0),
    son: push?.son === false ? "0" : "1",
    langue: message.langue,
  };
  if (push?.silencieux) {
    return {
      token,
      data: donnees,
      android: { priority: "normal" },
      apns: {
        headers: { "apns-priority": "5", "apns-push-type": "background" },
        payload: { aps: { "content-available": 1, badge: push.badge } },
      },
    };
  }
  const urgent = push?.niveau === "URGENT";
  const son = push?.son !== false;
  const androidNotification: Record<string, unknown> = {
    channel_id: push?.canalAndroid ?? "syndicup",
    notification_priority: urgent ? "PRIORITY_MAX" : push?.niveau === "INFO" || push?.interruption === "passive" ? "PRIORITY_DEFAULT" : "PRIORITY_HIGH",
    visibility: "PUBLIC",
    default_vibrate_timings: urgent || son,
    notification_count: push?.badge ?? undefined,
    click_action: "FLUTTER_NOTIFICATION_CLICK",
    ticker: message.titre,
  };
  if (son) androidNotification.sound = "default";
  else androidNotification.default_sound = false;
  if (push?.cleRegroupement) androidNotification.tag = push.cleRegroupement;
  const aps: Record<string, unknown> = {
    alert: { title: message.titre, body: message.corps },
    badge: push?.badge ?? undefined,
    "interruption-level": push?.interruption ?? "active",
    "thread-id": push?.fil ?? "general",
    category: "SYNDICUP_NOTIFICATION",
    "mutable-content": 1,
  };
  if (son) aps.sound = "default";
  return {
    token,
    notification: { title: message.titre, body: message.corps },
    data: donnees,
    android: {
      priority: "high",
      ...(push?.cleRegroupement ? { collapse_key: push.cleRegroupement } : {}),
      notification: androidNotification,
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert", ...(push?.cleRegroupement ? { "apns-collapse-id": push.cleRegroupement } : {}) },
      payload: { aps },
    },
  };
}

export function fcmTransport(
  serviceAccountJson: string = process.env.FCM_SERVICE_ACCOUNT_JSON ?? "",
  fetchImpl: FetchLike = (u, i) => fetch(u, i)
): NotificationTransport {
  const sa = parseServiceAccount(serviceAccountJson);
  let cache: { token: string; expire: number } | null = null;

  async function accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cache && cache.expire - 60 > now) return cache.token;
    const key = await importPKCS8(sa.private_key, "RS256");
    const assertion = await new SignJWT({ scope: SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(sa.token_uri ?? "https://oauth2.googleapis.com/token")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const res = await fetchImpl(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    if (!res.ok) throw new Error(`OAuth2 FCM refusé (${res.status}).`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    cache = { token: data.access_token, expire: now + (data.expires_in ?? 3600) };
    return data.access_token;
  }

  return {
    canal: "PUSH",
    async envoyer(message): Promise<ResultatEnvoi> {
      const tokens = message.destinataire.tokensPush ?? [];
      if (tokens.length === 0) return { statut: "EN_ATTENTE" };

      const bearer = await accessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
      let envoyes = 0;
      const invalides: string[] = [];
      let ref: string | undefined;

      for (const token of tokens) {
        try {
          const res = await fetchImpl(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message: construireMessageFcm(token, message) }),
          });
          if (res.ok) {
            envoyes++;
            const body = (await res.json().catch(() => ({}))) as { name?: string };
            ref = ref ?? body.name;
            continue;
          }
          const err = (await res.json().catch(() => ({}))) as {
            error?: { status?: string; details?: Array<{ errorCode?: string }> };
          };
          const code = err.error?.details?.find((d) => d.errorCode)?.errorCode ?? err.error?.status;
          if (res.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") {
            invalides.push(token);
          }
          logger.warn("FCM : envoi refusé pour un appareil", {
            statut_http: res.status,
            code,
            destinataire: { utilisateur_id: message.destinataire.utilisateurId },
          });
        } catch (e) {
          logger.warn("FCM : erreur réseau", { erreur: e instanceof Error ? e.message : String(e) });
        }
      }

      return {
        statut: envoyes > 0 ? "ENVOYE" : "ECHOUE",
        fournisseurRef: ref,
        tokensInvalides: invalides.length > 0 ? invalides : undefined,
      };
    },
  };
}
