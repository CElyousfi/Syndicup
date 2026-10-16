/** Abonnements SyndicUp (M29) — rappels quotidiens à 09:00 heure de Casablanca. Logique : lib/abonnements/jobs.ts. */
import { inngest } from "../client";
import { executerRappelsAbonnements } from "../../lib/abonnements/jobs";

export const abonnementsRappelsQuotidien = inngest.createFunction(
  { id: "abonnements-rappels-quotidien", triggers: [{ cron: "TZ=Africa/Casablanca 0 9 * * *" }] },
  async () => executerRappelsAbonnements()
);
