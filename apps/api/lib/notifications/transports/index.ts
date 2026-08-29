/**
 * Factory des transports — env-driven, noop par défaut (statut honnête EN_ATTENTE).
 * WHATSAPP : optionnel phase 2 (Master Spec Partie 7.4) — noop assumé.
 */
import type { CanalNotification, NotificationTransport } from "./types";
import { noopTransport } from "./noop";
import { resendTransport } from "./resend";
import { smtpTransport } from "./smtp";
import { fcmTransport } from "./fcm";
import { devSmsTransport, genericSmsTransport, twilioSmsTransport } from "./sms";

const cache = new Map<CanalNotification, NotificationTransport>();

export function transportPour(canal: CanalNotification): NotificationTransport {
  const existant = cache.get(canal);
  if (existant) return existant;

  let transport: NotificationTransport;
  switch (canal) {
    case "EMAIL": {
      // Priorité : API Resend (clé posée) > SMTP (Inbucket en local, SMTP transactionnel en
      // prod) > noop honnête. Même code local et production — seule l'URL change.
      const resendKey = process.env.RESEND_API_KEY;
      const resendFrom = process.env.RESEND_FROM;
      const smtpUrl = process.env.SMTP_URL;
      const emailFrom = process.env.EMAIL_FROM ?? resendFrom;
      if (resendKey && resendFrom) transport = resendTransport(resendKey, resendFrom);
      else if (smtpUrl && emailFrom) transport = smtpTransport(smtpUrl, emailFrom);
      else transport = noopTransport("EMAIL");
      break;
    }
    case "PUSH":
      transport = process.env.FCM_SERVICE_ACCOUNT_JSON ? fcmTransport() : noopTransport("PUSH");
      break;
    case "SMS": {
      const provider = process.env.SMS_PROVIDER;
      if (
        provider === "twilio" &&
        process.env.SMS_API_KEY &&
        process.env.SMS_API_SECRET &&
        process.env.SMS_SENDER_ID
      ) {
        transport = twilioSmsTransport(
          process.env.SMS_API_KEY,
          process.env.SMS_API_SECRET,
          process.env.SMS_SENDER_ID
        );
      } else if (provider === "generic" && process.env.SMS_API_URL && process.env.SMS_API_KEY) {
        transport = genericSmsTransport(
          process.env.SMS_API_URL,
          process.env.SMS_API_KEY,
          process.env.SMS_SENDER_ID
        );
      } else if (provider === "dev" && process.env.SMTP_URL) {
        transport = devSmsTransport(process.env.SMTP_URL);
      } else {
        transport = noopTransport("SMS");
      }
      break;
    }
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
