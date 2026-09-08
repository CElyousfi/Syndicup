/** Jobs Import (M24) — exécution asynchrone d'un import (chunks idempotents) ; purge quotidienne des résidences de démonstration expirées. Logique dans lib/import/*.ts (testée). */
import { inngest } from "../client";
import { executerImportEvenement, purgerDemos } from "../../lib/import/jobs";

export const importExecuter = inngest.createFunction(
  { id: "import-executer", triggers: [{ event: "import/executer" }], retries: 2 },
  async ({ event }) => executerImportEvenement(event.data as { copropriete_id: string; import_job_id: string; utilisateur_id: string })
);
export const demoPurgeQuotidien = inngest.createFunction(
  { id: "demo-purge-quotidien", triggers: [{ cron: "30 3 * * *" }] },
  async () => purgerDemos()
);
