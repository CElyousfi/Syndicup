/** Jobs Parkings (M23) — expirations / démarrages d'attributions et dépassements visiteurs chaque matin ; appel de fonds REDEVANCE_PARKING le 1er du mois. Logique dans lib/parkings/jobs.ts (testée). */
import { inngest } from "../client";
import { executerParkingsQuotidienToutesCoproprietes, executerRedevancesParkingToutesCoproprietes } from "../../lib/parkings/jobs";

export const parkingsQuotidien = inngest.createFunction(
  { id: "parkings-quotidien", triggers: [{ cron: "0 7 * * *" }] },
  async () => executerParkingsQuotidienToutesCoproprietes()
);
export const parkingsRedevancesMensuel = inngest.createFunction(
  { id: "parkings-redevances-mensuel", triggers: [{ cron: "0 6 1 * *" }] },
  async () => executerRedevancesParkingToutesCoproprietes()
);
