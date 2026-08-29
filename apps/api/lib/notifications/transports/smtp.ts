/**
 * Transport EMAIL via SMTP (nodemailer) — activé par SMTP_URL + EMAIL_FROM.
 *
 * Le MÊME code sert le local et la production (parité voulue) :
 *  - local : SMTP_URL=smtp://127.0.0.1:54325 → Inbucket de Supabase (boîte visible sur
 *    http://127.0.0.1:54324) — les emails sont réellement livrés à un serveur SMTP.
 *  - production : n'importe quel SMTP transactionnel (Resend expose smtp.resend.com:465,
 *    OVH/Infomaniak/SES aussi) — ou garder le transport API Resend (prioritaire si
 *    RESEND_API_KEY est posé, voir la factory index.ts).
 */
import { createTransport, type Transporter } from "nodemailer";
import type { NotificationTransport } from "./types";
import { logger } from "../../logging/logger";

export function smtpTransport(smtpUrl: string, from: string): NotificationTransport {
  let transporter: Transporter | null = null;
  const get = () => (transporter ??= createTransport(smtpUrl));

  return {
    canal: "EMAIL",
    async envoyer(message) {
      if (!message.destinataire.email) return { statut: "ECHOUE" };
      try {
        const info = await get().sendMail({
          from,
          to: message.destinataire.email,
          subject: message.titre,
          text: message.corps,
        });
        return { statut: "ENVOYE", fournisseurRef: info.messageId };
      } catch (e) {
        logger.error("Envoi email SMTP échoué", {
          erreur: e instanceof Error ? e.message : String(e),
        });
        return { statut: "ECHOUE" };
      }
    },
  };
}
