/**
 * Moteur de paie — M20 (Doc A §9.2 « CNSS obligatoire »). AIDE AU CALCUL interne : tous les taux,
 * plafonds et tranches viennent de `copropriete.parametres_paie_json`, saisis par le syndic et
 * PROVISOIRES (LEGAL_QUESTIONS_BRIEF §11) — aucune valeur n'est codée ici. Sans paramètres, la
 * validation d'une fiche est refusée (422 PAIE_PARAMETRES_NON_CONFIGURES). Le PDF porte la mention
 * « document généré par SyndicUp à partir des paramètres saisis par le syndic ».
 * Calcul pur (decimal.js via lib/money, arrondi au centime) :
 *   brut total = brut + primes ; retenue d'absence = brut / jours ouvrés × jours d'absence injustifiée
 *   (si le paramètre l'active) ; base = brut total − retenue d'absence ;
 *   CNSS salariale = min(base, plafond) × taux ; AMO salariale = base × taux ;
 *   frais professionnels = min(base × taux, plafond mensuel) ; net imposable = base − CNSS − AMO − frais ;
 *   IR = barème annuel progressif (net imposable × 12 → tranche → taux − somme à déduire) / 12 ;
 *   net à payer = base − CNSS − AMO − IR − retenues ;
 *   patronal = CNSS (plafonnée) + allocations familiales + AMO + formation professionnelle ;
 *   coût total employeur = base + patronal. Charges de famille / autres déductions : non modélisées (signalé).
 */
import { z } from "zod";
import type Decimal from "decimal.js";
import { money, toApiString } from "../money";

const taux = z.string().regex(/^\d{1,3}(\.\d{1,4})?$/, "Taux en pourcentage (ex. \"4.48\").");
const montant = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Montant décimal invalide.");

export const trancheIrSchema = z.object({
  // Borne haute annuelle incluse ; null = dernière tranche.
  jusqua: montant.nullable(),
  taux,
  deduction: montant,
});

export const parametresPaieSchema = z.object({
  smig_mensuel: montant.nullish(),
  taux_cnss_salarial: taux,
  plafond_cnss: montant,
  taux_amo_salarial: taux,
  taux_cnss_patronal: taux,
  taux_allocations_familiales: taux,
  taux_amo_patronal: taux,
  taux_formation_pro: taux,
  taux_frais_professionnels: taux,
  plafond_frais_professionnels_mensuel: montant,
  tranches_ir: z.array(trancheIrSchema).min(1).max(12),
  jours_conge_annuels: z.string().regex(/^\d{1,3}(\.\d)?$/, "Jours de congé (ex. \"18\").").nullish(),
  jours_ouvres_mois: z.number().int().min(20).max(31).default(26),
  retenue_absence_injustifiee: z.boolean().default(true),
  // Traçabilité de la source des valeurs saisies (texte libre : « Loi de finances 2025, art. … »).
  source: z.string().max(500).nullish(),
});
export type ParametresPaie = z.infer<typeof parametresPaieSchema>;

export function lireParametresPaie(json: unknown): ParametresPaie | null {
  if (json === null || json === undefined) return null;
  const parsed = parametresPaieSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export interface EntreesPaie {
  brut: string;
  primes?: string | null;
  retenues?: string | null;
  jours_absence_injustifiee?: number;
}

const c2 = (d: Decimal) => d.toDecimalPlaces(2);
const pct = (base: Decimal, t: string) => c2(base.times(money(t)).dividedBy(100));

export function calculerPaie(p: ParametresPaie, e: EntreesPaie) {
  const brut = money(e.brut);
  const primes = money(e.primes ?? 0);
  const retenues = money(e.retenues ?? 0);
  const brutTotal = brut.plus(primes);
  const joursAbs = Math.max(0, e.jours_absence_injustifiee ?? 0);
  const retenueAbsences = p.retenue_absence_injustifiee && joursAbs > 0 ? c2(brut.dividedBy(p.jours_ouvres_mois).times(joursAbs)) : money(0);
  const base = brutTotal.minus(retenueAbsences).greaterThan(0) ? brutTotal.minus(retenueAbsences) : money(0);
  const plafond = money(p.plafond_cnss);
  const baseCnss = base.greaterThan(plafond) ? plafond : base;
  const cnssSal = pct(baseCnss, p.taux_cnss_salarial);
  const amoSal = pct(base, p.taux_amo_salarial);
  const fraisPro = (() => {
    const f = pct(base, p.taux_frais_professionnels);
    const pl = money(p.plafond_frais_professionnels_mensuel);
    return f.greaterThan(pl) ? pl : f;
  })();
  let netImposable = base.minus(cnssSal).minus(amoSal).minus(fraisPro);
  if (netImposable.lessThan(0)) netImposable = money(0);
  const annuel = netImposable.times(12);
  const tranches = [...p.tranches_ir].sort((a, b) => (a.jusqua === null ? 1 : b.jusqua === null ? -1 : money(a.jusqua).comparedTo(money(b.jusqua))));
  const tranche = tranches.find((t) => t.jusqua === null || annuel.lessThanOrEqualTo(money(t.jusqua))) ?? tranches[tranches.length - 1]!;
  let irAnnuel = c2(annuel.times(money(tranche.taux)).dividedBy(100).minus(money(tranche.deduction)));
  if (irAnnuel.lessThan(0)) irAnnuel = money(0);
  const ir = c2(irAnnuel.dividedBy(12));
  let net = base.minus(cnssSal).minus(amoSal).minus(ir).minus(retenues);
  if (net.lessThan(0)) net = money(0);
  const cnssPat = pct(baseCnss, p.taux_cnss_patronal);
  const allocFam = pct(base, p.taux_allocations_familiales);
  const amoPat = pct(base, p.taux_amo_patronal);
  const formation = pct(base, p.taux_formation_pro);
  const totalPat = cnssPat.plus(allocFam).plus(amoPat).plus(formation);
  const totalSal = cnssSal.plus(amoSal).plus(ir);
  return {
    brut: toApiString(brut),
    primes: toApiString(primes),
    retenues: toApiString(retenues),
    brut_total: toApiString(brutTotal),
    retenue_absences: toApiString(retenueAbsences),
    jours_absence_injustifiee: joursAbs,
    base_cotisations: toApiString(base),
    cotisations_salariales: { cnss: toApiString(cnssSal), amo: toApiString(amoSal), ir: toApiString(ir), total: toApiString(totalSal) },
    cotisations_patronales: { cnss: toApiString(cnssPat), allocations_familiales: toApiString(allocFam), amo: toApiString(amoPat), formation_pro: toApiString(formation), total: toApiString(totalPat) },
    frais_professionnels: toApiString(fraisPro),
    net_imposable: toApiString(netImposable),
    ir_annuel: toApiString(irAnnuel),
    tranche_ir: { jusqua: tranche.jusqua, taux: tranche.taux, deduction: tranche.deduction },
    net: toApiString(net),
    cout_total_employeur: toApiString(base.plus(totalPat)),
    sous_smig: p.smig_mensuel ? brut.lessThan(money(p.smig_mensuel)) : null,
    parametres: { ...p },
  };
}
export type ResultatPaie = ReturnType<typeof calculerPaie>;

/** Jours ouvrables (lundi → samedi) entre deux dates incluses — Doc A : le gardien travaille 6 jours / 7. */
export function joursOuvrables(debut: Date, fin: Date): number {
  let n = 0;
  for (let d = new Date(debut); d <= fin; d = new Date(d.getTime() + 86_400_000)) {
    if (d.getUTCDay() !== 0) n += 1;
  }
  return n;
}
