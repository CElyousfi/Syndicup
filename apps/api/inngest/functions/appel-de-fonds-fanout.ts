/**
 * Fan-out asynchrone des notifications d'appel de fonds — l'« étape 5 » du Master Spec Partie
 * 6.2, déclenchée par l'événement "finances/appel_de_fonds.emis" (émis en fin de
 * genererAppelDeFonds). Idempotent côté lib (rejeu/retry sans double envoi).
 */
import { inngest } from "../client";
import { notifierAppelDeFonds } from "../../lib/finances/notifications-appels";

export const appelDeFondsFanout = inngest.createFunction(
  { id: "appel-de-fonds-fanout", triggers: [{ event: "finances/appel_de_fonds.emis" }] },
  async ({ event }) => {
    const { copropriete_id, appel_de_fonds_id } = event.data as {
      copropriete_id: string;
      appel_de_fonds_id: string;
    };
    return notifierAppelDeFonds(copropriete_id, appel_de_fonds_id);
  }
);
