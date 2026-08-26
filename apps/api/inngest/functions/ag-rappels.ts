/**
 * Job quotidien — rappels d'échéance AG (Master Spec Partie 15.3).
 * Logique dans lib/ag/rappels.ts ; N jours avant = paramètre technique (AG_RAPPEL_JOURS_AVANT).
 */
import { inngest } from "../client";
import { executerRappelsAg } from "../../lib/ag/rappels";

export const agRappels = inngest.createFunction(
  { id: "ag-rappels-quotidiens", triggers: [{ cron: "0 8 * * *" }] },
  async () => {
    const resultats = await executerRappelsAg();
    return { ags: resultats.length, notifies: resultats.reduce((a, r) => a + r.notifies, 0) };
  }
);
