/**
 * Transport SMS — trois fournisseurs sélectionnés par SMS_PROVIDER :
 *
 *  - "twilio"  : Twilio Programmable Messaging (routes internationales dont Maroc).
 *      SMS_API_KEY = Account SID · SMS_API_SECRET = Auth Token · SMS_SENDER_ID = From
 *      (numéro E.164 ou Sender ID alphanumérique selon l'accord opérateur marocain).
 *  - "generic" : SEAM neutre pour l'agrégateur marocain à contractualiser (Master Spec
 *      Partie 1.8) — POST JSON `{ to, body, sender }` sur SMS_API_URL avec
 *      `Authorization: Bearer SMS_API_KEY`. Le format s'ajuste au contrat réel ici,
 *      dans un seul fichier.
 *  - "dev"     : livraison locale RÉELLE vers l'Inbucket Supabase (chaque SMS devient un
 *      email `sms+<numéro>@sms.local` visible sur http://127.0.0.1:54324) — même flux,
 *      même statut ENVOYE honnête : le message a été remis au fournisseur configuré.
 *
 * Jamais de faux ENVOYE : tout échec fournisseur = ECHOUE tracé.
 */
import { createTransport, type Transporter } from "nodemailer";
import type { NotificationTransport } from "./types";
import { logger } from "../../logging/logger";

export function twilioSmsTransport(
  accountSid: string,
  authToken: string,
  senderId: string
): NotificationTransport {
  return {
    canal: "SMS",
    async envoyer(message) {
      const to = message.destinataire.telephone;
      if (!to) return { statut: "ECHOUE" };
      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: to.startsWith("+") ? to : `+${to}`,
              From: senderId,
              Body: `${message.titre}\n${message.corps}`,
            }),
          }
        );
        if (!res.ok) {
          logger.error("Envoi SMS Twilio échoué", { http_status: res.status });
          return { statut: "ECHOUE" };
        }
        const data = (await res.json()) as { sid?: string };
        return { statut: "ENVOYE", fournisseurRef: data.sid };
      } catch (e) {
        logger.error("Envoi SMS Twilio échoué (réseau)", {
          erreur: e instanceof Error ? e.message : String(e),
        });
        return { statut: "ECHOUE" };
      }
    },
  };
}

export function genericSmsTransport(
  apiUrl: string,
  apiKey: string,
  senderId: string | undefined
): NotificationTransport {
  return {
    canal: "SMS",
    async envoyer(message) {
      const to = message.destinataire.telephone;
      if (!to) return { statut: "ECHOUE" };
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to,
            body: `${message.titre}\n${message.corps}`,
            ...(senderId ? { sender: senderId } : {}),
          }),
        });
        if (!res.ok) {
          logger.error("Envoi SMS (agrégateur) échoué", { http_status: res.status });
          return { statut: "ECHOUE" };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { statut: "ENVOYE", fournisseurRef: data.id };
      } catch (e) {
        logger.error("Envoi SMS (agrégateur) échoué (réseau)", {
          erreur: e instanceof Error ? e.message : String(e),
        });
        return { statut: "ECHOUE" };
      }
    },
  };
}

export function devSmsTransport(smtpUrl: string): NotificationTransport {
  let transporter: Transporter | null = null;
  const get = () => (transporter ??= createTransport(smtpUrl));

  return {
    canal: "SMS",
    async envoyer(message) {
      const to = message.destinataire.telephone;
      if (!to) return { statut: "ECHOUE" };
      try {
        const info = await get().sendMail({
          from: "SyndicUp SMS <sms@syndicup.local>",
          to: `sms+${to.replace(/^\+/, "")}@sms.local`,
          subject: `[SMS → ${to}] ${message.titre}`,
          text: message.corps,
        });
        return { statut: "ENVOYE", fournisseurRef: info.messageId };
      } catch (e) {
        logger.error("Envoi SMS (passerelle dev Inbucket) échoué", {
          erreur: e instanceof Error ? e.message : String(e),
        });
        return { statut: "ECHOUE" };
      }
    },
  };
}
