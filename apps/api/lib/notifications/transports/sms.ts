/**
 * Transport SMS — SEAM neutre fournisseur : l'agrégateur marocain n'est pas encore
 * contractualisé (décision ouverte Master Spec Partie 1.8). Activé par SMS_API_URL +
 * SMS_API_KEY ; le format d'appel exact sera ajusté au contrat de l'agrégateur retenu.
 * Échec EXPLICITE tant que non finalisé : jamais un faux ENVOYE.
 */
import type { NotificationTransport } from "./types";
import { logger } from "../../logging/logger";

export function smsTransport(): NotificationTransport {
  return {
    canal: "SMS",
    async envoyer(message) {
      logger.warn(
        "SMS configuré mais agrégateur non contractualisé — format d'appel à ajuster (Master Spec Partie 1.8)",
        { destinataire: { telephone: message.destinataire.telephone } }
      );
      return { statut: "EN_ATTENTE" };
    },
  };
}
