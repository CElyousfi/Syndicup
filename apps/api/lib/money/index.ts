/**
 * lib/money — point de passage OBLIGATOIRE pour toute arithmétique financière (CLAUDE.md §1.1,
 * Master Spec Partie 1.7.1). Aucune addition/multiplication de montant ne doit exister ailleurs
 * dans le codebase, y compris dans les jobs Inngest et les tests.
 *
 * Choix : decimal.js (pas de `number` natif JS pour un montant, jamais). Toute valeur qui entre
 * ou sort de cette lib est sérialisée en string décimale à 2 décimales — jamais un float JSON
 * (voir aussi Money schema dans packages/api-contract/openapi.yaml).
 *
 * npm install decimal.js  (à ajouter au package.json de apps/api quand ce fichier prend son
 * premier vrai appelant — volontairement pas encore dans les dépendances de ce scaffold pour
 * ne pas figer une version avant le premier usage réel).
 */

import Decimal from "decimal.js";

// numeric(14,2) côté Postgres — 2 décimales fixes, arrondi bancaire (ROUND_HALF_EVEN) pour éviter
// le biais systématique que produirait un arrondi "toujours vers le haut" sur des milliers de
// lignes d'appel de fonds.
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export type MoneyInput = string | number | Decimal;

/** Parse une entrée externe (payload API, ligne DB) en valeur monétaire interne. */
export function money(value: MoneyInput): Decimal {
  return new Decimal(value).toDecimalPlaces(2);
}

export function add(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).plus(money(b)).toDecimalPlaces(2);
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).minus(money(b)).toDecimalPlaces(2);
}

/**
 * Répartit un montant total au prorata des tantièmes d'une liste de lots, en garantissant que
 * la somme des lignes générées == montant_total à la centime près (test critique, Master Spec
 * Partie 16.2). L'écart d'arrondi résiduel (toujours < nb_lots centimes) est absorbé par le
 * dernier lot de la liste — c'est un choix arbitraire mais déterministe et auditable ; à
 * documenter dans la PR si un autre choix (plus gros lot, alphabétique...) est retenu à la place.
 */
export function repartirAuProrata(
  montantTotal: MoneyInput,
  lots: { lotId: string; tantiemes: MoneyInput }[]
): { lotId: string; montant: Decimal }[] {
  const total = money(montantTotal);
  const totalTantiemes = lots.reduce((acc, l) => acc.plus(money(l.tantiemes)), new Decimal(0));

  if (totalTantiemes.isZero()) {
    throw new Error("Somme des tantièmes = 0 — impossible de répartir (vérifier la donnée lot).");
  }

  const lignes = lots.map((l) => ({
    lotId: l.lotId,
    montant: total.times(money(l.tantiemes)).dividedBy(totalTantiemes).toDecimalPlaces(2),
  }));

  const sommeLignes = lignes.reduce((acc, l) => acc.plus(l.montant), new Decimal(0));
  const ecart = total.minus(sommeLignes);

  if (!ecart.isZero() && lignes.length > 0) {
    const dernier = lignes[lignes.length - 1]!;
    dernier.montant = dernier.montant.plus(ecart).toDecimalPlaces(2);
  }

  return lignes;
}

/** Sérialisation pour l'API — toujours une string à 2 décimales, jamais un float. */
export function toApiString(value: MoneyInput): string {
  return money(value).toFixed(2);
}

export function isEqual(a: MoneyInput, b: MoneyInput): boolean {
  return money(a).equals(money(b));
}

export function isGreaterThan(a: MoneyInput, b: MoneyInput): boolean {
  return money(a).greaterThan(money(b));
}
