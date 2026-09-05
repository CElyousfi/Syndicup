/**
 * Vue de transparence « où va mon argent » — M18 (Doc A §3.5). Tout membre de la copropriété,
 * locataires compris. Agrégats de niveau copropriété UNIQUEMENT : budget vs réalisé par poste
 * (prévu / réalisé), réserve, taux de recouvrement, NOMBRE de lots en retard — jamais quels lots ni
 * les montants par lot. Liste des dépenses PAYEE (libellé, catégorie, montant, date, prestataire) ;
 * factures exposées seulement si `copropriete.factures_visibles_residents` (défaut false).
 * Les rapports de gestion soumis à l'AG apparaissent via leurs documents PUBLIC_COPROPRIETE (RLS).
 */
import { can } from "../auth/permissions";
import { withTenant } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { calculerBudgetVsRealise } from "../depenses/rapports";
import { creerUrlSignee } from "../storage/supabase-storage";
import { money, toApiString } from "../money";
import { depensesParCategorie, depensesPayees } from "./chiffres";
import { PermissionRefuseeError } from "./erreurs";

export async function vueTransparence(ctx: TenantContext, exerciceDemande?: string, pagination = { page: 1, limit: 20 }, maintenant = new Date()) {
  void maintenant;
  if (can("rapports.transparence.lire", ctx.role) !== true) throw new PermissionRefuseeError("Rôle non autorisé à consulter la transparence financière.");
  const exercice = exerciceDemande ?? String(maintenant.getUTCFullYear());
  return withTenant(ctx, async (db) => {
    // Agrégats (sommes / comptes uniquement) via la fonction SECURITY DEFINER `transparence_agregats` :
    // les policies RLS des lignes d'appel, paiements et réserve (résident = ses lots) restent intactes.
    const [copro, agregats, depenses, bvr, rapports] = await Promise.all([
      db.copropriete.findUnique({ where: { id: ctx.coproprieteId }, select: { nom: true, facturesVisiblesResidents: true } }),
      db.$queryRaw<{ total_entrees: string; total_sorties_compte_courant: string; reserve: string; reserve_configuree: boolean; appele_exercice: string; encaisse_exercice: string; impayes_total: string; nb_lots_en_retard: number }[]>`
        SELECT total_entrees::text, total_sorties_compte_courant::text, reserve::text, reserve_configuree, appele_exercice::text, encaisse_exercice::text, impayes_total::text, nb_lots_en_retard
        FROM public.transparence_agregats(${ctx.coproprieteId}::uuid, ${exercice})`,
      depensesPayees(db, ctx.coproprieteId, exercice),
      calculerBudgetVsRealise(db, ctx.coproprieteId, exercice),
      db.document.findMany({ where: { coproprieteId: ctx.coproprieteId, type: "RAPPORT_GESTION", visibilite: "PUBLIC_COPROPRIETE" }, select: { id: true, nom: true, creeLe: true }, orderBy: { creeLe: "desc" }, take: 10 }),
    ]);
    const facturesVisibles = copro?.facturesVisiblesResidents === true;
    const a = agregats[0];
    if (!a) throw new PermissionRefuseeError("Copropriété hors périmètre.");
    const appele = money(a.appele_exercice), encaisse = money(a.encaisse_exercice);
    const skip = (pagination.page - 1) * pagination.limit;
    const page = depenses.slice().reverse().slice(skip, skip + pagination.limit);
    let factures: Record<string, { id: string; numero: string | null; montant_ttc: string; url: string }[]> = {};
    if (facturesVisibles && page.length > 0) {
      // Les factures sont lues via une fonction SECURITY DEFINER (la RLS `facture` reste syndic / conseil) :
      // limitée aux dépenses PAYEE de la copropriété courante ET à l'option activée.
      const rows = await db.$queryRaw<{ id: string; depense_id: string; numero: string | null; montant_ttc: string; storage_path: string }[]>`
        SELECT * FROM public.transparence_factures(${ctx.coproprieteId}::uuid, ${page.map((d) => d.id)}::uuid[])`;
      factures = {};
      for (const f of rows) {
        (factures[f.depense_id] ??= []).push({ id: f.id, numero: f.numero, montant_ttc: toApiString(f.montant_ttc), url: await creerUrlSignee(f.storage_path) });
      }
    }
    return {
      exercice,
      copropriete: copro?.nom ?? null,
      factures_visibles: facturesVisibles,
      // Agrégats de niveau copropriété — aucune donnée par lot.
      tresorerie: { compte_courant_estime: toApiString(money(a.total_entrees).minus(money(a.total_sorties_compte_courant))), reserve: toApiString(a.reserve), reserve_configuree: a.reserve_configuree },
      recouvrement: { exercice: appele.isZero() ? null : encaisse.dividedBy(appele).times(100).toDecimalPlaces(1).toString(), appele: toApiString(appele), encaisse: toApiString(encaisse) },
      impayes: { total: toApiString(a.impayes_total), nb_lots_en_retard: a.nb_lots_en_retard },
      budget_vs_realise: {
        budget: bvr.budget,
        postes: bvr.postes.map((p) => ({ poste_id: p.poste_id, libelle: p.libelle, categorie: p.categorie, montant_prevu: p.montant_prevu, realise: p.realise, pourcentage_realise: p.pourcentage_realise, depassement: p.depassement })),
        totaux: { montant_prevu: bvr.totaux.montant_prevu, realise: bvr.totaux.realise, pourcentage_realise: bvr.totaux.pourcentage_realise },
        fonds_reserve: bvr.fonds_reserve,
      },
      depenses_par_categorie: depensesParCategorie(depenses),
      depenses: page.map((d) => ({ ...d, factures: facturesVisibles ? (factures[d.id] ?? []) : undefined })),
      meta: { total: depenses.length, page: pagination.page, has_more: skip + pagination.limit < depenses.length },
      rapports_gestion: rapports.map((r) => ({ document_id: r.id, nom: r.nom, date: r.creeLe.toISOString() })),
    };
  });
}

/** PATCH /coproprietes/{id}/transparence — le syndic active / désactive la visibilité des factures. */
export async function definirFacturesVisibles(ctx: TenantContext, coproprieteId: string, visible: boolean) {
  if (can("rapports.gestion.gerer", ctx.role) !== true) throw new PermissionRefuseeError("Seul le syndic modifie la visibilité des factures.");
  if (coproprieteId !== ctx.coproprieteId) throw new PermissionRefuseeError("Copropriété hors périmètre.");
  return withTenant(ctx, async (db) => {
    const avant = await db.copropriete.findUnique({ where: { id: coproprieteId }, select: { facturesVisiblesResidents: true } });
    const apres = await db.copropriete.update({ where: { id: coproprieteId }, data: { facturesVisiblesResidents: visible }, select: { id: true, facturesVisiblesResidents: true } });
    const { ecrireAuditLog } = await import("../audit/audit");
    await ecrireAuditLog(db, { coproprieteId, acteurId: ctx.utilisateurId, action: "TRANSPARENCE_FACTURES_MODIFIEE", entite: "copropriete", entiteId: coproprieteId, avant: { factures_visibles_residents: avant?.facturesVisiblesResidents ?? false }, apres: { factures_visibles_residents: apres.facturesVisiblesResidents } });
    return { factures_visibles_residents: apres.facturesVisiblesResidents };
  });
}
