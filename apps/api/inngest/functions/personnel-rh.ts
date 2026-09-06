/** Jobs Personnel RH (M20) — paie mensuelle (le 25) + fins de contrat ; rappel quotidien des congés en attente. Logique dans lib/personnel/jobs.ts (testée). */
import { inngest } from "../client";
import { executerPaieMensuelleToutesCoproprietes, executerRappelCongesToutesCoproprietes } from "../../lib/personnel/jobs";

export const personnelMensuel = inngest.createFunction(
  { id: "personnel-mensuel", triggers: [{ cron: "0 7 25 * *" }] },
  async () => executerPaieMensuelleToutesCoproprietes()
);
export const personnelCongesRappel = inngest.createFunction(
  { id: "personnel-conges-rappel", triggers: [{ cron: "15 7 * * *" }] },
  async () => executerRappelCongesToutesCoproprietes()
);
