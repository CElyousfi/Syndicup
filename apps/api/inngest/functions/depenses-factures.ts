/**
 * Job quotidien — factures fournisseurs (M16) : rappel au syndic J-7 avant l'échéance d'une facture
 * non réglée (FACTURE_ECHEANCE_PROCHE). Idempotent (rejeu sans doublon). Logique dans
 * lib/depenses/jobs.ts (testée) ; cette fonction n'est que le scheduler.
 */
import { inngest } from "../client";
import { executerRappelsFacturesToutesCoproprietes } from "../../lib/depenses/jobs";

export const depensesFactures = inngest.createFunction(
  { id: "depenses-factures-echeances", triggers: [{ cron: "0 7 * * *" }] },
  async () => executerRappelsFacturesToutesCoproprietes()
);
