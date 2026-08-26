/**
 * Transport PUSH via Firebase Cloud Messaging — SEAM : l'adaptateur existe (activé par
 * FCM_SERVICE_ACCOUNT_JSON) mais le flux OAuth2 service-account + l'enregistrement des tokens
 * d'appareils (table à créer avec le module mobile M12 UI) ne sont pas encore implémentés.
 * Échec EXPLICITE si configuré : jamais un faux ENVOYE.
 */
import type { NotificationTransport } from "./types";
import { logger } from "../../logging/logger";

export function fcmTransport(): NotificationTransport {
  return {
    canal: "PUSH",
    async envoyer(message) {
      logger.warn(
        "FCM configuré mais intégration incomplète (tokens d'appareils + OAuth2 à implémenter avec le client mobile)",
        { destinataire: { utilisateur_id: message.destinataire.utilisateurId } }
      );
      return { statut: "EN_ATTENTE" };
    },
  };
}
