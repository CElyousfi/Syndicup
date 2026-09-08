/** Jobs Import (M24) : exécution d'un import (événement `import/executer`) et purge des démonstrations expirées (cron). */
import type { TenantContext } from "../tenant/context";
import { executerImport } from "./import";
import { purgerDemosExpirees } from "./demo";

export async function executerImportEvenement(data: { copropriete_id: string; import_job_id: string; utilisateur_id: string }) {
  const ctx: TenantContext = { utilisateurId: data.utilisateur_id, coproprieteId: data.copropriete_id, role: "SYNDIC" };
  const r = await executerImport(ctx, data.import_job_id);
  return { import_job_id: r.id, statut: r.statut, nb_traitees: r.nbTraitees, nb_erreurs: r.nbErreurs };
}
export const purgerDemos = (now = new Date()) => purgerDemosExpirees(now);
