/**
 * Job quotidien — séjours de location courte durée (M15) : rappel d'arrivée au gardien le
 * matin de date_arrivee, clôture automatique EN_COURS→TERMINE le lendemain de date_depart si
 * le gardien n'a pas confirmé (jamais PREVU→EN_COURS automatiquement). Idempotent (rejeu sans
 * doublon). Logique dans lib/lcd/lcd.ts (testée) ; cette fonction n'est que le scheduler.
 */
import { inngest } from "../client";
import { executerSejoursQuotidienToutesCoproprietes } from "../../lib/lcd/jobs";

export const lcdSejours = inngest.createFunction(
  { id: "lcd-sejours-quotidien", triggers: [{ cron: "0 6 * * *" }] },
  async () => executerSejoursQuotidienToutesCoproprietes()
);
