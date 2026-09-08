/** Jobs Communication (M21) — digest hebdomadaire (lundi 09:00) ; publications programmées et clôture des sondages échus (horaire). Logique dans lib/communication/jobs.ts (testée). */
import { inngest } from "../client";
import { executerDigestToutesCoproprietes, executerProgrammeesToutesCoproprietes } from "../../lib/communication/jobs";

export const communicationDigestHebdo = inngest.createFunction(
  { id: "communication-digest-hebdo", triggers: [{ cron: "0 9 * * 1" }] },
  async () => executerDigestToutesCoproprietes()
);
export const communicationProgrammees = inngest.createFunction(
  { id: "communication-programmees-horaire", triggers: [{ cron: "5 * * * *" }] },
  async () => executerProgrammeesToutesCoproprietes()
);
