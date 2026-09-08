/** Job Tâches (M22) — rappels J-3 / J-0 / retard chaque matin, synthèse hebdomadaire des retards le lundi. Logique dans lib/taches/jobs.ts (testée). */
import { inngest } from "../client";
import { executerRappelsTachesToutesCoproprietes } from "../../lib/taches/jobs";

export const tachesRappelsQuotidien = inngest.createFunction(
  { id: "taches-rappels-quotidien", triggers: [{ cron: "0 8 * * *" }] },
  async () => executerRappelsTachesToutesCoproprietes()
);
