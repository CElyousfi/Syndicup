/**
 * Job mensuel — anonymisation CNDP (Loi 09-08, Master Spec Partie 5.6/15.3).
 * La logique vit dans lib/users/anonymisation.ts (testée) : les copropriétés sans
 * retention_desactivation_mois configurée sont SAUTÉES (valeur légalement gatée —
 * LEGAL_QUESTIONS_BRIEF §5), jamais de durée devinée.
 */
import { inngest } from "../client";
import { executerAnonymisationCndp } from "../../lib/users/anonymisation";

export const anonymisationCndp = inngest.createFunction(
  { id: "anonymisation-cndp-mensuelle", triggers: [{ cron: "0 4 1 * *" }] },
  async () => executerAnonymisationCndp()
);
