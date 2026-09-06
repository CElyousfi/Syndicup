/**
 * Jobs Contrats (M19) — quotidien : rappels J-30 / J-7, échéances manquées, expiration / reconduction
 * tacite ; mensuel : alerte « aucune assurance immeuble active ». Logique dans lib/contrats/jobs.ts (testée).
 */
import { inngest } from "../client";
import { executerAlerteAssuranceToutesCoproprietes, executerJobContratsToutesCoproprietes } from "../../lib/contrats/jobs";

export const contratsEcheances = inngest.createFunction(
  { id: "contrats-echeances-quotidien", triggers: [{ cron: "0 6 * * *" }] },
  async () => executerJobContratsToutesCoproprietes()
);

export const contratsAssurance = inngest.createFunction(
  { id: "contrats-assurance-mensuel", triggers: [{ cron: "0 8 1 * *" }] },
  async () => executerAlerteAssuranceToutesCoproprietes()
);
