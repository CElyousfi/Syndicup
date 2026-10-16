/**
 * Grille tarifaire SyndicUp (en ligne sur syndicup.pro depuis le 14 oct. 2026 — source du site :
 * lib/pricing.ts du dépôt Syndicupwebsite). Sert UNIQUEMENT à proposer un prix à l'ouverture d'un
 * abonnement : le prix retenu est ensuite figé sur l'abonnement (la grille peut changer, le prix
 * garanti d'un client fondateur ne bouge pas). Toute arithmétique passe par lib/money.
 *
 *  - Syndicats : prix TTC par lot et par mois (le syndicat ne récupère pas la TVA).
 *  - Cabinets  : prix HT par lot et par mois, dégressif sur le total de lots, minimum annuel.
 *  - Facturation mensuelle : +15 %. Remise fondateur : déjà intégrée aux prix fondateur.
 */
import { applyRate, maxOf, multiply, toApiString } from "../money";

export type Formule = "ESSENTIEL" | "STANDARD" | "PRESTIGE" | "CABINET";
export type Periodicite = "ANNUELLE" | "MENSUELLE";

export const TVA_STANDARD = "20.00";
export const MAJORATION_MENSUELLE = "1.15";
export const DUREE_ESSAI_JOURS = 30;
export const DUREE_PRIX_GARANTI_MOIS = 24;
export const DELAI_GRACE_DEFAUT_JOURS = 15;

const SYNDICAT: Record<Exclude<Formule, "CABINET">, { catalogue: string; fondateur: string; minimumMensuel: string; libelle: string; charges: string }> = {
  ESSENTIEL: { catalogue: "5.90", fondateur: "5.00", minimumMensuel: "99.00", libelle: "Essentiel", charges: "< 250 MAD/lot/mois" },
  STANDARD: { catalogue: "9.90", fondateur: "8.40", minimumMensuel: "149.00", libelle: "Standard", charges: "250 – 600 MAD/lot/mois" },
  PRESTIGE: { catalogue: "14.90", fondateur: "12.60", minimumMensuel: "390.00", libelle: "Prestige", charges: "> 600 MAD/lot/mois" },
};

/** Cabinet (≥ 3 mandats) : HT, dégressif sur le total de lots ; minimum 6 000 HT/an = 500 HT/mois. */
const CABINET_PALIERS: { aPartirDe: number; prix: string }[] = [
  { aPartirDe: 3000, prix: "2.60" },
  { aPartirDe: 1000, prix: "3.20" },
  { aPartirDe: 0, prix: "3.90" },
];
const CABINET_MINIMUM_MENSUEL_HT = "500.00";

/** Option « Accompagné » : forfait annuel TTC selon la taille. */
export function forfaitAccompagneSuggere(lots: number): string {
  return lots <= 120 ? "3900.00" : "5900.00";
}

export const LIBELLES_FORMULE: Record<Formule, string> = {
  ESSENTIEL: "Essentiel",
  STANDARD: "Standard",
  PRESTIGE: "Prestige",
  CABINET: "Cabinet",
};

export interface TarifSuggere {
  formule: Formule;
  base_prix: "TTC" | "HT";
  prix_lot: string;
  prix_catalogue: string;
  minimum_mensuel: string;
  taux_tva: string;
  tarif_fondateur: boolean;
  periodicite: Periodicite;
  /** Montant mensuel estimé (lots × prix, au moins le minimum), dans la base du prix. */
  mensuel_estime: string;
  /** Montant annuel estimé, dans la base du prix. */
  annuel_estime: string;
  forfait_accompagne_suggere: string;
  repere_charges: string | null;
}

/** Prix proposé pour une formule, un nombre de lots, une périodicité et le statut fondateur. */
export function tarifSuggere(params: { formule: Formule; lots: number; periodicite: Periodicite; fondateur: boolean }): TarifSuggere {
  const { formule, lots, periodicite } = params;
  let base: "TTC" | "HT";
  let catalogue: string;
  let prix: string;
  let minimum: string;
  let fondateur = params.fondateur;
  let repere: string | null = null;

  if (formule === "CABINET") {
    base = "HT";
    catalogue = CABINET_PALIERS.find((p) => lots >= p.aPartirDe)!.prix;
    prix = catalogue;
    minimum = CABINET_MINIMUM_MENSUEL_HT;
    fondateur = false; // pas de remise fondateur pour les cabinets
  } else {
    const g = SYNDICAT[formule];
    base = "TTC";
    catalogue = g.catalogue;
    prix = fondateur ? g.fondateur : g.catalogue;
    minimum = g.minimumMensuel;
    repere = g.charges;
  }

  if (periodicite === "MENSUELLE") {
    prix = applyRate(prix, MAJORATION_MENSUELLE).toFixed(2);
    minimum = applyRate(minimum, MAJORATION_MENSUELLE).toFixed(2);
  }

  const mensuel = maxOf(multiply(prix, lots), minimum);

  return {
    formule,
    base_prix: base,
    prix_lot: toApiString(prix),
    prix_catalogue: toApiString(catalogue),
    minimum_mensuel: toApiString(minimum),
    taux_tva: TVA_STANDARD,
    tarif_fondateur: fondateur,
    periodicite,
    mensuel_estime: toApiString(mensuel),
    annuel_estime: toApiString(multiply(mensuel, 12)),
    forfait_accompagne_suggere: forfaitAccompagneSuggere(lots),
    repere_charges: repere,
  };
}
