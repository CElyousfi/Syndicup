/** Job quotidien — justificatifs de paiement (M17) : rappel au syndic au-delà du délai configuré. Idempotent. */
import { inngest } from "../client";
import { executerRelanceJustificatifsToutesCoproprietes } from "../../lib/justificatifs/jobs";

export const justificatifsRelance = inngest.createFunction(
  { id: "justificatifs-relance-syndic", triggers: [{ cron: "30 7 * * *" }] },
  async () => executerRelanceJustificatifsToutesCoproprietes()
);
