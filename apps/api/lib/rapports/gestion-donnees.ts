/**
 * Forme de `rapport_gestion.donnees_json` (version 1) — M18. Instantané figé de TOUS les chiffres du
 * rapport (montants en chaînes décimales) : le PDF est rendu depuis cet objet, jamais recalculé.
 * Construit par `construireDonneesRapport` à partir des mêmes fonctions que le tableau de bord et
 * le grand livre → réconciliable (test rapports.test.ts).
 */
import type { TenantDb } from "../tenant/db";
import type { TenantContext } from "../tenant/context";
import { calculerBudgetVsRealise, type BudgetVsRealise } from "../depenses/rapports";
import { toApiString } from "../money";
import { agencerAnciennete, debutExercice, depensesParCategorie, depensesPayees, faitsMarquants, finExercice, impayesParLot, isoDate, justificatifsEnAttente, lignesImpayees, recouvrement, type DepensePayee, type Recouvrement } from "./chiffres";
import { calculerGrandLivre } from "./grand-livre";

export interface RapportGestionDonnees {
  version: 1;
  exercice: string;
  genere_le: string;
  copropriete: { id: string; nom: string; adresse: string; ville: string; nb_lots: number; logo_storage_path: string | null };
  syndic: { id: string; nom: string | null };
  president_conseil: { id: string | null; nom: string | null };
  budget_ag_id: string | null;
  tresorerie: {
    reserve_configuree: boolean;
    ouverture: { compte_courant: string; reserve: string };
    totaux: { entrees: string; sorties_compte_courant: string; sorties_reserve: string; mouvements_reserve: string };
    cloture: { compte_courant: string; reserve: string };
  };
  grand_livre_nb_lignes: number;
  recouvrement: Recouvrement;
  impayes: ReturnType<typeof agencerAnciennete> & { par_lot: ReturnType<typeof impayesParLot>; arrete_le: string };
  budget_vs_realise: BudgetVsRealise;
  depenses_par_categorie: ReturnType<typeof depensesParCategorie>;
  depenses: DepensePayee[];
  reserve: { solde_ouverture: string; solde_cloture: string; mouvements: { id: string; date: string; type: string; montant: string; description: string | null; depense_id: string | null }[] };
  faits_marquants: Awaited<ReturnType<typeof faitsMarquants>>;
  justificatifs_en_attente: { nb: number; montant: string };
  seuil_approbation_non_configure: boolean;
}

export async function construireDonneesRapport(db: TenantDb, ctx: TenantContext, exercice: string, budgetAgId: string | null, maintenant = new Date()): Promise<RapportGestionDonnees> {
  const [copro, syndic, president, gl, recouv, impayes, depenses, bvr, faits, justifs, fonds] = await Promise.all([
    db.copropriete.findUniqueOrThrow({ where: { id: ctx.coproprieteId }, select: { id: true, nom: true, adresse: true, ville: true, nbLots: true, logoStoragePath: true } }),
    db.utilisateur.findUnique({ where: { id: ctx.utilisateurId }, select: { id: true, nom: true, prenom: true, raisonSociale: true } }),
    db.roleUtilisateur.findFirst({ where: { coproprieteId: ctx.coproprieteId, role: "CONSEIL_SYNDICAL", actif: true }, orderBy: { creeLe: "asc" }, select: { utilisateur: { select: { id: true, nom: true, prenom: true } } } }),
    calculerGrandLivre(db, ctx.coproprieteId, exercice),
    recouvrement(db, ctx.coproprieteId, exercice, maintenant),
    lignesImpayees(db, ctx.coproprieteId, maintenant),
    depensesPayees(db, ctx.coproprieteId, exercice),
    calculerBudgetVsRealise(db, ctx.coproprieteId, exercice),
    faitsMarquants(db, ctx.coproprieteId, exercice),
    justificatifsEnAttente(db, ctx.coproprieteId),
    db.fondsReserve.findUnique({ where: { coproprieteId: ctx.coproprieteId }, select: { mouvements: { where: { horodatage: { gte: debutExercice(exercice), lt: finExercice(exercice) } }, orderBy: { horodatage: "asc" }, select: { id: true, type: true, montant: true, description: true, depenseId: true, horodatage: true } } } }),
  ]);
  const nomComplet = (u: { nom: string | null; prenom: string | null; raisonSociale?: string | null } | null | undefined) =>
    u ? (u.raisonSociale || [u.prenom, u.nom].filter(Boolean).join(" ") || null) : null;
  return {
    version: 1,
    exercice,
    genere_le: maintenant.toISOString(),
    copropriete: { id: copro.id, nom: copro.nom, adresse: copro.adresse, ville: copro.ville, nb_lots: copro.nbLots, logo_storage_path: copro.logoStoragePath },
    syndic: { id: ctx.utilisateurId, nom: nomComplet(syndic) },
    president_conseil: { id: president?.utilisateur.id ?? null, nom: nomComplet(president?.utilisateur) },
    budget_ag_id: budgetAgId ?? bvr.budget?.id ?? null,
    tresorerie: {
      reserve_configuree: fonds !== null,
      ouverture: gl.ouverture,
      totaux: gl.totaux,
      cloture: gl.cloture,
    },
    grand_livre_nb_lignes: gl.nb_lignes,
    recouvrement: recouv.exercice,
    impayes: { ...agencerAnciennete(impayes), par_lot: impayesParLot(impayes), arrete_le: isoDate(maintenant) },
    budget_vs_realise: bvr,
    depenses_par_categorie: depensesParCategorie(depenses),
    depenses,
    reserve: {
      solde_ouverture: gl.ouverture.reserve,
      solde_cloture: gl.cloture.reserve,
      mouvements: (fonds?.mouvements ?? []).map((m) => ({ id: m.id, date: isoDate(m.horodatage), type: m.type, montant: toApiString(m.montant), description: m.description, depense_id: m.depenseId })),
    },
    faits_marquants: faits,
    justificatifs_en_attente: justifs,
    seuil_approbation_non_configure: bvr.seuil_non_configure,
  };
}
