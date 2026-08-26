/**
 * Job quotidien — scan d'escalade des impayés N1→N6 (Master Spec Partie 15.3, Doc A §3.3).
 * La logique vit dans lib/finances/escalade.ts (testée) ; cette fonction n'est que le scheduler.
 */
import { inngest } from "../client";
import { executerEscaladeImpayesToutesCoproprietes } from "../../lib/finances/escalade";

export const escaladeImpayes = inngest.createFunction(
  { id: "escalade-impayes-quotidienne", triggers: [{ cron: "0 3 * * *" }] },
  async () => {
    const resultats = await executerEscaladeImpayesToutesCoproprietes();
    return {
      coproprietes: resultats.length,
      erreurs: resultats.filter((r) => r.erreur).length,
    };
  }
);
