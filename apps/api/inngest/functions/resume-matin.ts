/** Résumé du matin (opt-in) — 08:00 heure de Casablanca, un push discret par membre qui l'a demandé. Logique dans lib/notifications/resume-matin.ts (composition testée). */
import { inngest } from "../client";
import { executerResumeMatinToutesCoproprietes } from "../../lib/notifications/resume-matin";

export const resumeMatinQuotidien = inngest.createFunction(
  { id: "resume-matin-quotidien", triggers: [{ cron: "TZ=Africa/Casablanca 0 8 * * *" }] },
  async () => executerResumeMatinToutesCoproprietes()
);
