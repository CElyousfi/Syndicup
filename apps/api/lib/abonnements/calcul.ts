/**
 * Montants d'une facture d'abonnement — fonction pure (tests/abonnements-etat.test.ts).
 * Lignes exprimées dans la base du prix de l'abonnement (TTC pour un syndicat, HT pour un
 * cabinet) ; totaux décomposés HT / TVA / TTC au centime près via lib/money.
 */
import Decimal from "decimal.js";
import { add, addTva, maxOf, multiply, money, splitTtc, toApiString, type MoneyInput } from "../money";
import { LIBELLES_FORMULE, type Formule } from "./tarifs";

export interface LigneFacture {
  libelle: string;
  quantite: string;
  prix_unitaire: string;
  montant: string;
}

export interface MontantsFacture {
  base_prix: "TTC" | "HT";
  lignes: LigneFacture[];
  montant_ht: string;
  montant_tva: string;
  montant_ttc: string;
}

export interface ParametresFacture {
  formule: Formule;
  basePrix: "TTC" | "HT";
  prixLot: MoneyInput;
  tauxTva: MoneyInput;
  minimumMensuel: MoneyInput | null;
  forfaitAccompagne: MoneyInput | null;
  lots: number;
  mois: number;
  tarifFondateur: boolean;
  lignesSupplementaires?: { libelle: string; montant: MoneyInput }[];
}

export function calculerFacture(p: ParametresFacture): MontantsFacture {
  if (!Number.isInteger(p.lots) || p.lots <= 0) throw new Error("Nombre de lots invalide.");
  if (!Number.isInteger(p.mois) || p.mois <= 0) throw new Error("Durée de facturation invalide.");

  const lignes: LigneFacture[] = [];
  const mensuelBrut = multiply(p.prixLot, p.lots);
  const mensuel = p.minimumMensuel === null ? mensuelBrut : maxOf(mensuelBrut, p.minimumMensuel);
  const fondateur = p.tarifFondateur ? " — tarif fondateur" : "";
  const nom = `Abonnement SyndicUp ${LIBELLES_FORMULE[p.formule]}${fondateur}`;

  if (mensuel.equals(mensuelBrut)) {
    lignes.push({
      libelle: `${nom} — ${p.lots} lots × ${toApiString(p.prixLot)} MAD ${p.basePrix} / lot / mois`,
      quantite: String(p.mois),
      prix_unitaire: toApiString(mensuelBrut),
      montant: toApiString(multiply(mensuelBrut, p.mois)),
    });
  } else {
    lignes.push({
      libelle: `${nom} — minimum de facturation mensuel (${p.lots} lots)`,
      quantite: String(p.mois),
      prix_unitaire: toApiString(mensuel),
      montant: toApiString(multiply(mensuel, p.mois)),
    });
  }

  if (p.forfaitAccompagne !== null && !money(p.forfaitAccompagne).isZero()) {
    // Forfait annuel, au prorata des mois facturés.
    const prorata = multiply(p.forfaitAccompagne, new Decimal(p.mois).dividedBy(12));
    lignes.push({
      libelle: "Option Accompagné (forfait annuel au prorata)",
      quantite: `${p.mois}/12`,
      prix_unitaire: toApiString(p.forfaitAccompagne),
      montant: toApiString(prorata),
    });
  }

  for (const l of p.lignesSupplementaires ?? []) {
    lignes.push({ libelle: l.libelle, quantite: "1", prix_unitaire: toApiString(l.montant), montant: toApiString(l.montant) });
  }

  const total = lignes.reduce<Decimal>((acc, l) => add(acc, l.montant), money(0));
  const t = p.basePrix === "TTC" ? splitTtc(total, p.tauxTva) : addTva(total, p.tauxTva);
  return {
    base_prix: p.basePrix,
    lignes,
    montant_ht: toApiString(t.ht),
    montant_tva: toApiString(t.tva),
    montant_ttc: toApiString(t.ttc),
  };
}

/** Nombre de mois facturés par période selon la périodicité. */
export function moisParPeriode(periodicite: "ANNUELLE" | "MENSUELLE"): number {
  return periodicite === "ANNUELLE" ? 12 : 1;
}
