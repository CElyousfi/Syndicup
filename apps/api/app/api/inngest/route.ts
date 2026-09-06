/**
 * Endpoint de service Inngest — hors /v1 (infrastructure, pas le contrat public OpenAPI ;
 * exclu de la vérification de conformité contrat↔routes). Master Spec Partie 15.3.
 * Local : `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest`.
 */
import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { escaladeImpayes } from "../../../inngest/functions/escalade-impayes";
import { anonymisationCndp } from "../../../inngest/functions/anonymisation-cndp";
import { agRappels } from "../../../inngest/functions/ag-rappels";
import { appelDeFondsFanout } from "../../../inngest/functions/appel-de-fonds-fanout";
import { lcdSejours } from "../../../inngest/functions/lcd-sejours";
import { depensesFactures } from "../../../inngest/functions/depenses-factures";
import { justificatifsRelance } from "../../../inngest/functions/justificatifs-relance";
import { contratsEcheances, contratsAssurance } from "../../../inngest/functions/contrats-echeances";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [escaladeImpayes, anonymisationCndp, agRappels, appelDeFondsFanout, lcdSejours, depensesFactures, justificatifsRelance, contratsEcheances, contratsAssurance],
});
