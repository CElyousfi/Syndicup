/**
 * Transport no-op — défaut tant qu'aucun fournisseur n'est configuré (M0 non provisionné).
 * HONNÊTE : retourne EN_ATTENTE (rien n'a été envoyé), jamais un faux ENVOYE. Le message est
 * loggé (téléphone masqué par le logger) pour la traçabilité en dev.
 */
import type { NotificationTransport, CanalNotification } from "./types";
import { logger } from "../../logging/logger";

export function noopTransport(canal: CanalNotification): NotificationTransport {
  return {
    canal,
    async envoyer(message) {
      logger.info("Notification non envoyée — aucun transport configuré (noop)", {
        canal,
        destinataire: {
          utilisateur_id: message.destinataire.utilisateurId,
          telephone: message.destinataire.telephone,
        },
        titre: message.titre,
        langue: message.langue,
      });
      return { statut: "EN_ATTENTE" };
    },
  };
}
