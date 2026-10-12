/**
 * Composition pure de l'instantané widget (GET /users/me/widget) — aucune dépendance base,
 * testable seule. Les montants restent des Decimal / chaînes (jamais de float).
 */
import { money, toApiString, type MoneyInput } from "../money";

// ── Types de sortie ──────────────────────────────────────────────────────────

export interface WidgetCharges {
  /** Somme (dû − payé) sur les lignes non closes des lots de l'appelant. */
  solde_du: string;
  nb_lots: number;
  /** Lot à ouvrir depuis le widget (unique lot, sinon null → liste). */
  lot_id: string | null;
  /** Prochaine échéance non soldée (ISO date) et son reste à payer. */
  prochaine_echeance: string | null;
  prochain_montant: string | null;
  /** Part payée de l'exercice en cours (0..1) : l'anneau de progression. */
  taux_paye: number;
  /** Nombre de quittances disponibles (lignes payées). */
  nb_quittances: number;
}

export interface WidgetAg {
  id: string;
  type: string;
  date_ag: string;
  statut: string;
  nb_resolutions: number;
  /** Résolutions sur lesquelles l'appelant (via ses lots) a déjà voté — 0 pour la gestion. */
  nb_votees: number;
}

export interface WidgetResidence {
  taux_recouvrement: number;
  impaye_total: string;
  incidents_ouverts: number;
  incidents_sla_depasse: number;
  reservations_a_valider: number;
  /** Taux de recouvrement des 6 derniers appels, du plus ancien au plus récent (sparkline). */
  recouvrement_6: number[];
}

export interface WidgetAnnonce {
  id: string;
  titre: string;
  categorie: string;
  urgent: boolean;
  publie_le: string | null;
  lu: boolean;
}

export interface WidgetGardien {
  visites_en_attente: number;
  arrivees_lcd_aujourdhui: number;
  departs_lcd_aujourdhui: number;
  incidents_ouverts: number;
}

export interface WidgetSnapshot {
  genere_le: string;
  role: string;
  copropriete: { id: string; nom: string } | null;
  charges: WidgetCharges | null;
  ag: WidgetAg | null;
  residence: WidgetResidence | null;
  affichage: { non_lues: number; annonces: WidgetAnnonce[] } | null;
  gardien: WidgetGardien | null;
}

// ── Composition pure (testable sans base) ────────────────────────────────────

export interface LigneCharge {
  lotId: string;
  montantDu: MoneyInput;
  montantPaye: MoneyInput;
  statut: "PAYE" | "PARTIEL" | "IMPAYE";
  dateEcheance: Date;
  appelStatut: "BROUILLON" | "EMIS" | "CLOTURE";
}

export function composerCharges(lotIds: string[], lignes: LigneCharge[]): WidgetCharges {
  const emises = lignes.filter((l) => l.appelStatut !== "BROUILLON");
  let du = money(0);
  let paye = money(0);
  let solde = money(0);
  let prochaine: { date: Date; reste: ReturnType<typeof money> } | null = null;
  let quittances = 0;
  for (const l of emises) {
    du = du.plus(money(l.montantDu));
    paye = paye.plus(money(l.montantPaye));
    const reste = money(l.montantDu).minus(money(l.montantPaye));
    if (l.statut === "PAYE") quittances += 1;
    if (reste.greaterThan(0)) {
      solde = solde.plus(reste);
      if (!prochaine || l.dateEcheance < prochaine.date) prochaine = { date: l.dateEcheance, reste };
    }
  }
  return {
    solde_du: toApiString(solde),
    nb_lots: lotIds.length,
    lot_id: lotIds.length === 1 ? lotIds[0]! : null,
    prochaine_echeance: prochaine ? prochaine.date.toISOString().slice(0, 10) : null,
    prochain_montant: prochaine ? toApiString(prochaine.reste) : null,
    taux_paye: du.greaterThan(0) ? Math.min(1, Number(paye.div(du).toFixed(4))) : 1,
    nb_quittances: quittances,
  };
}

export interface AppelPourResidence {
  id: string;
  periode: string;
  statut: "BROUILLON" | "EMIS" | "CLOTURE";
}

export function composerRecouvrement(appels: AppelPourResidence[], lignes: Array<{ appelDeFondsId: string; montantDu: MoneyInput; montantPaye: MoneyInput }>) {
  const emis = appels.filter((a) => a.statut !== "BROUILLON").sort((a, b) => a.periode.localeCompare(b.periode));
  const parAppel = new Map<string, { du: ReturnType<typeof money>; paye: ReturnType<typeof money> }>();
  for (const l of lignes) {
    const acc = parAppel.get(l.appelDeFondsId) ?? { du: money(0), paye: money(0) };
    acc.du = acc.du.plus(money(l.montantDu));
    acc.paye = acc.paye.plus(money(l.montantPaye));
    parAppel.set(l.appelDeFondsId, acc);
  }
  const taux = (id: string) => {
    const t = parAppel.get(id);
    return t && t.du.greaterThan(0) ? Number(t.paye.div(t.du).toFixed(4)) : 1;
  };
  const recouvrement_6 = emis.slice(-6).map((a) => taux(a.id));
  let du = money(0);
  let paye = money(0);
  for (const a of emis) {
    const t = parAppel.get(a.id);
    if (!t) continue;
    du = du.plus(t.du);
    paye = paye.plus(t.paye);
  }
  return {
    taux_recouvrement: du.greaterThan(0) ? Number(paye.div(du).toFixed(4)) : 1,
    impaye_total: toApiString(du.minus(paye).lessThan(0) ? money(0) : du.minus(paye)),
    recouvrement_6,
  };
}

/** Catégories qui barrent le widget d'une bande « urgent ». */
export const CATEGORIES_URGENTES = new Set(["URGENCE", "COUPURE", "SECURITE"]);

