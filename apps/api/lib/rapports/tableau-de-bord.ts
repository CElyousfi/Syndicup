/**
 * Tableau de bord syndic / conseil — M18 (Doc A §8). Trésorerie (compte courant estimé + réserve),
 * série 12 mois, recouvrement (exercice + mois), impayés par ancienneté, top 5 lots en retard,
 * dépenses par catégorie (exercice + mois), budget vs réalisé, incidents ouverts par urgence,
 * justificatifs en attente (M17), contrats et assurance (M19).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { calculerBudgetVsRealise } from "../depenses/rapports";
import { agencerAnciennete, depensesParCategorie, depensesPayees, impayesParLot, incidentsOuvertsParUrgence, justificatifsEnAttente, lignesImpayees, moisDe, recouvrement, tresorerie, tresorerieMensuelle } from "./chiffres";
import { PermissionRefuseeError } from "./erreurs";
import { indicateursContrats } from "../contrats/contrats";

export async function tableauDeBord(ctx: TenantContext, exerciceDemande?: string, maintenant = new Date()) {
  if (can("rapports.syndic.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter le tableau de bord de gestion.");
  const exercice = exerciceDemande ?? String(maintenant.getUTCFullYear());
  return withTenant(ctx, async (db) => {
    const [treso, serie, recouv, impayes, depenses, bvr, incidents, justificatifs, contrats] = await Promise.all([
      tresorerie(db, ctx.coproprieteId),
      tresorerieMensuelle(db, ctx.coproprieteId, 12, maintenant),
      recouvrement(db, ctx.coproprieteId, exercice, maintenant),
      lignesImpayees(db, ctx.coproprieteId, maintenant),
      depensesPayees(db, ctx.coproprieteId, exercice),
      calculerBudgetVsRealise(db, ctx.coproprieteId, exercice),
      incidentsOuvertsParUrgence(db, ctx.coproprieteId),
      justificatifsEnAttente(db, ctx.coproprieteId),
      indicateursContrats(db, ctx.coproprieteId, maintenant),
    ]);
    const mois = moisDe(maintenant);
    return {
      exercice,
      genere_le: maintenant.toISOString(),
      tresorerie: { ...treso, serie_12_mois: serie },
      recouvrement: recouv,
      impayes: { ...agencerAnciennete(impayes), top_lots: impayesParLot(impayes).slice(0, 5) },
      depenses: { exercice: depensesParCategorie(depenses), mois: { mois, ...depensesParCategorie(depenses, (d) => d.date.startsWith(mois)) } },
      budget_vs_realise: bvr,
      incidents_ouverts: incidents,
      justificatifs_en_attente: justificatifs,
      // M19 — contrats : actifs, à échoir (30 j), expirés récents, échéances des 30 prochains jours, assurance.
      contrats,
    };
  });
}
