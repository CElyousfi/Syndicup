/**
 * Factory des transports — env-driven, noop par défaut (statut honnête EN_ATTENTE).
 * WHATSAPP : optionnel phase 2 (Master Spec Partie 7.4) — noop assumé.
 */
import type { CanalNotification, NotificationTransport } from "./types";
import { noopTransport } from "./noop";
import { resendTransport } from "./resend";
import { fcmTransport } from "./fcm";
import { smsTransport } from "./sms";

const cache = new Map<CanalNotification, NotificationTransport>();

export function transportPour(canal: CanalNotification): NotificationTransport {
  const existant = cache.get(canal);
  if (existant) return existant;

  let transport: NotificationTransport;
  switch (canal) {
    case "EMAIL": {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.RESEND_FROM;
      transport = key && from ? resendTransport(key, from) : noopTransport("EMAIL");
      break;
    }
    case "PUSH":
      transport = process.env.FCM_SERVICE_ACCOUNT_JSON ? fcmTransport() : noopTransport("PUSH");
      break;
    case "SMS":
      transport =
        process.env.SMS_API_URL && process.env.SMS_API_KEY ? smsTransport() : noopTransport("SMS");
      break;
    default:
      transport = noopTransport(canal);
  }
  cache.set(canal, transport);
  return transport;
}

/** Réservé aux tests : force la re-résolution des transports. */
export function _resetTransports(): void {
  cache.clear();
}
