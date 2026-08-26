/**
 * Émission d'événements Inngest — l'émission NE DOIT JAMAIS faire échouer la requête HTTP
 * appelante (l'écriture métier est déjà commitée) : échec loggé pour reprise manuelle.
 */
import { inngest } from "../../inngest/client";
import { logger } from "../logging/logger";

export async function emitEvent(
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await inngest.send({ name, data });
  } catch (e) {
    logger.warn("Émission d'événement Inngest échouée (non bloquant)", {
      evenement: name,
      erreur: e instanceof Error ? e.message : String(e),
    });
  }
}
