/**
 * Comptabilité autonome — toutes les dérivations d'un exercice (année civile) à partir du
 * grand livre : appels de fonds, lignes par lot, paiements, budget. AUCUNE saisie humaine,
 * aucun float : centimes BigInt de bout en bout (CLAUDE.md §1.1). Sert la page
 * « Comptabilité » / « Mon relevé » et les exports CSV.
 */
import type { AppelDeFonds, AppelDeFondsLigne, BudgetAg, Lot, Paiement } from "./api/types";
import { ratio, sommeCentimes, versCentimes, versChaine } from "./centimes";
import type { SyntheseFinanciere } from "./finances-data";

export interface ExerciceFinancier {
  annee: string;
  appels: AppelDeFonds[];
  lignes: AppelDeFondsLigne[];
  paiements: Paiement[];
}

const NIVEAUX = ["N0", "N1", "N2", "N3", "N4", "N5", "N6"] as const;

/**
 * Années couvertes par des appels de fonds (la plus récente d'abord).
 * `perimetreLignes` : ne retenir que les exercices où l'appelant a au moins une ligne — un
 * résident ne doit jamais voir un exercice « à zéro » qui ne concerne que les autres lots.
 */
export function exercicesDisponibles(s: SyntheseFinanciere, perimetreLignes = false): string[] {
  const appelsVisibles = perimetreLignes
    ? new Set(s.lignes.map((l) => l.appelDeFondsId))
    : null;
  const annees = new Set(
    s.appels.filter((a) => !appelsVisibles || appelsVisibles.has(a.id)).map((a) => a.periode.slice(0, 4))
  );
  return [...annees].sort((a, b) => b.localeCompare(a));
}

/** Restreint la synthèse et les paiements à un exercice. */
export function exercice(s: SyntheseFinanciere, paiements: Paiement[], annee: string): ExerciceFinancier {
  const appels = s.appels.filter((a) => a.periode.startsWith(annee));
  const ids = new Set(appels.map((a) => a.id));
  const lignes = s.lignes.filter((l) => ids.has(l.appelDeFondsId));
  const ligneIds = new Set(lignes.map((l) => l.id));
  return {
    annee,
    appels,
    lignes,
    paiements: paiements.filter((p) => ligneIds.has(p.appelDeFondsLotId) || p.horodatage.startsWith(annee)),
  };
}

export interface TotauxMontants {
  du: bigint;
  paye: bigint;
  restant: bigint;
  taux: number;
}

function totaux(lignes: AppelDeFondsLigne[]): TotauxMontants {
  const du = sommeCentimes(lignes.map((l) => l.montantDu));
  const paye = sommeCentimes(lignes.map((l) => l.montantPaye));
  return { du, paye, restant: du - paye, taux: ratio(paye, du) };
}

export function totauxExercice(e: ExerciceFinancier): TotauxMontants {
  return totaux(e.lignes);
}

/** Ligne par période (mois) — chronologique. */
export function parMois(e: ExerciceFinancier) {
  const parPeriode = new Map<string, AppelDeFondsLigne[]>();
  const appelParId = new Map(e.appels.map((a) => [a.id, a]));
  for (const l of e.lignes) {
    const a = appelParId.get(l.appelDeFondsId);
    if (!a) continue;
    parPeriode.set(a.periode, [...(parPeriode.get(a.periode) ?? []), l]);
  }
  return [...parPeriode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periode, lignes]) => ({ periode, nbAppels: e.appels.filter((a) => a.periode === periode).length, ...totaux(lignes) }));
}

/** Répartition par type d'appel (charges courantes, fonds de réserve…). */
export function parType(e: ExerciceFinancier) {
  const appelParId = new Map(e.appels.map((a) => [a.id, a]));
  const groupes = new Map<AppelDeFonds["type"], AppelDeFondsLigne[]>();
  for (const l of e.lignes) {
    const a = appelParId.get(l.appelDeFondsId);
    if (!a) continue;
    groupes.set(a.type, [...(groupes.get(a.type) ?? []), l]);
  }
  return [...groupes.entries()].map(([type, lignes]) => ({ type, ...totaux(lignes) }));
}

/** Relevé par lot : dû, payé, solde, retard maximal, dernier paiement. */
export function parLot(e: ExerciceFinancier, lots: Lot[]) {
  const lotParId = new Map(lots.map((l) => [l.id, l]));
  const groupes = new Map<string, AgLigne[]>();
  type AgLigne = AppelDeFondsLigne;
  for (const l of e.lignes) groupes.set(l.lotId, [...(groupes.get(l.lotId) ?? []), l]);
  const dernierPaiement = new Map<string, string>();
  for (const p of e.paiements) {
    const d = dernierPaiement.get(p.lotId);
    if (!d || p.horodatage > d) dernierPaiement.set(p.lotId, p.horodatage);
  }
  return [...groupes.entries()]
    .map(([lotId, lignes]) => {
      const t = totaux(lignes);
      const impayees = lignes.filter((l) => l.statut !== "PAYE");
      const escalade = impayees.reduce<(typeof NIVEAUX)[number]>(
        (max, l) => (NIVEAUX.indexOf(l.niveauEscalade as (typeof NIVEAUX)[number]) > NIVEAUX.indexOf(max) ? (l.niveauEscalade as (typeof NIVEAUX)[number]) : max),
        "N0"
      );
      return {
        lotId,
        numero: lotParId.get(lotId)?.numero ?? lotId.slice(0, 8),
        typeLot: lotParId.get(lotId)?.typeLot ?? null,
        ...t,
        nbImpayees: impayees.length,
        escalade,
        dernierPaiement: dernierPaiement.get(lotId) ?? null,
      };
    })
    .sort((a, b) => (b.restant > a.restant ? 1 : b.restant < a.restant ? -1 : a.numero.localeCompare(b.numero)));
}

/** Budget voté de l'exercice vs montant réellement appelé / encaissé. */
export function budgetVsRealise(budgets: BudgetAg[], e: ExerciceFinancier) {
  const budget = budgets.find((b) => b.exercice.startsWith(e.annee) && b.statut === "ACTIF") ??
    budgets.find((b) => b.exercice.startsWith(e.annee)) ?? null;
  const appele = sommeCentimes(e.appels.map((a) => a.montantTotal));
  const t = totauxExercice(e);
  const vote = budget ? versCentimes(budget.montantTotal) : 0n;
  return {
    budget,
    vote,
    appele,
    encaisse: t.paye,
    tauxAppele: ratio(appele, vote),
    tauxEncaisse: ratio(t.paye, vote),
    ecart: vote - appele,
  };
}

/** Journal des paiements enrichi (période, type, lot) — antéchronologique. */
export function journalPaiements(e: ExerciceFinancier, s: SyntheseFinanciere, lots: Lot[]) {
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));
  const appelParId = new Map(s.appels.map((a) => [a.id, a]));
  const ligneParId = new Map(s.lignes.map((l) => [l.id, l]));
  return e.paiements.map((p) => {
    const ligne = ligneParId.get(p.appelDeFondsLotId);
    const appel = ligne ? appelParId.get(ligne.appelDeFondsId) : undefined;
    return {
      ...p,
      montantC: versCentimes(p.montant),
      lotNumero: lotParId.get(p.lotId) ?? p.lotId.slice(0, 8),
      periode: appel?.periode ?? null,
      typeAppel: appel?.type ?? null,
    };
  });
}

// ── CSV ────────────────────────────────────────────────────────────────────

/** Montant au format tableur francophone : "1234,56". */
export function montantCsv(centimes: bigint): string {
  return versChaine(centimes).replace(".", ",");
}

function cellule(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV UTF-8 avec BOM (Excel) et séparateur « ; » (locales FR). */
export function csv(lignes: Array<Array<string | number | null | undefined>>): string {
  return "﻿" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n";
}
