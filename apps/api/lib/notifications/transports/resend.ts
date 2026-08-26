/**
 * Transport EMAIL via Resend (REST, sans SDK) — activé par RESEND_API_KEY + RESEND_FROM.
 * ⚠️ Jamais testé contre un compte Resend réel (M0) : domaine + SPF/DKIM/DMARC requis avant
 * production — voir checklist M0 (ROADMAP_BACKLOG.md).
 */
import type { NotificationTransport } from "./types";
import { logger } from "../../logging/logger";

export function resendTransport(apiKey: string, from: string): NotificationTransport {
  return {
    canal: "EMAIL",
    async envoyer(message) {
      if (!message.destinataire.email) return { statut: "ECHOUE" };
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: [message.destinataire.email],
            subject: message.titre,
            text: message.corps,
          }),
        });
        if (!res.ok) {
          logger.error("Envoi email Resend échoué", { http_status: res.status });
          return { statut: "ECHOUE" };
        }
        const data = (await res.json()) as { id?: string };
        return { statut: "ENVOYE", fournisseurRef: data.id };
      } catch (e) {
        logger.error("Envoi email Resend échoué (réseau)", {
          erreur: e instanceof Error ? e.message : String(e),
        });
        return { statut: "ECHOUE" };
      }
    },
  };
}
