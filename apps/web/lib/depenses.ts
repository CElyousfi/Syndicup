/**
 * Dérivations pures — Dépenses (M16). Aucun fetch, aucun float : centimes BigInt (lib/centimes).
 * Importable par les composants client.
 */
import type { BudgetPoste, Depense, StatutDepense } from "./api/types";

export const STATUTS_ONGLETS: Array<StatutDepense | "TOUS"> = ["TOUS", "A_APPROUVER", "APPROUVEE", "PAYEE", "BROUILLON", "REJETEE", "ANNULEE"];

/** Transitions offertes à l'écran selon le statut et le rôle (la vérité reste côté API). */
export function actionsPossibles(d: Pick<Depense, "statut">, role: { syndic: boolean; conseil: boolean }) {
  return {
    modifier: role.syndic && (d.statut === "BROUILLON" || d.statut === "REJETEE"),
    soumettre: role.syndic && (d.statut === "BROUILLON" || d.statut === "REJETEE"),
    decider: (role.syndic || role.conseil) && d.statut === "A_APPROUVER",
    payer: role.syndic && d.statut === "APPROUVEE",
    annuler: role.syndic && d.statut !== "PAYEE" && d.statut !== "ANNULEE",
    ajouterFacture: role.syndic && d.statut !== "ANNULEE",
  };
}

/** Postes filtrés par catégorie (cohérence poste ↔ catégorie imposée par l'API). */
export function postesPourCategorie(postes: BudgetPoste[], categorie: string): BudgetPoste[] {
  return postes.filter((p) => p.categorie === categorie);
}

/** Jours restants avant une échéance ISO (négatif = dépassée). */
export function joursAvant(iso: string | null): number | null {
  if (!iso) return null;
  const j = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const auj = new Date();
  auj.setUTCHours(0, 0, 0, 0);
  return Math.round((j - auj.getTime()) / 86400000);
}
