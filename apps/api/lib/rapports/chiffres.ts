/**
 * Moteur de chiffres — M18. Toutes les agrégations partagées par le tableau de bord, la vue de
 * transparence, le grand livre et le rapport de gestion vivent ICI, calculées sur le client tenant
 * (RLS active) : le rapport et le grand livre sont donc réconciliables par construction (test
 * rapports.test.ts). Aucune somme hors lib/money ; les sorties sont des chaînes décimales.
 *
 * Conventions de datation :
 *   - entrée = `paiement` VALIDE daté par `horodatage` (même règle que GET /finances/paiements) ;
 *   - sortie = `depense` PAYEE datée par `paye_le` (repli `date_depense`) ;
 *   - réserve = `fonds_reserve_mouvement` daté par `horodatage` (signé : + cotisation, − décaissement).
 *   Trésorerie « compte courant estimé » = Σ entrées − Σ sorties COMPTE_COURANT (décision M18 : aucune
 *   API bancaire, le solde réel se lit sur le relevé — cette estimation est une aide au rapprochement).
 */
import type Decimal from "decimal.js";
import type { TenantDb } from "../tenant/db";
import { money, toApiString } from "../money";
import { soldeFondsReserve } from "../depenses/depenses";

export const TRANCHES_ANCIENNETE = ["0_30", "31_90", "91_180", "PLUS_180"] as const;
export type TrancheAnciennete = (typeof TRANCHES_ANCIENNETE)[number];

export function debutExercice(exercice: string): Date {
  return new Date(`${exercice}-01-01T00:00:00.000Z`);
}
export function finExercice(exercice: string): Date {
  return new Date(`${Number(exercice) + 1}-01-01T00:00:00.000Z`);
}
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function moisDe(d: Date): string {
  return d.toISOString().slice(0, 7);
}
export function joursEntre(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
export function trancheAnciennete(retardJours: number): TrancheAnciennete {
  if (retardJours <= 30) return "0_30";
  if (retardJours <= 90) return "31_90";
  if (retardJours <= 180) return "91_180";
  return "PLUS_180";
}

const zero = () => money(0);
const somme = (xs: Iterable<Decimal>) => {
  let acc = zero();
  for (const x of xs) acc = acc.plus(x);
  return acc;
};

// ── Trésorerie ────────────────────────────────────────────────────────────────────────────────

export interface Tresorerie {
  compte_courant_estime: string;
  total_entrees: string;
  total_sorties_compte_courant: string;
  reserve: string;
  reserve_configuree: boolean;
}

/** Trésorerie cumulée à la date `avant` (exclue) — sans borne = à ce jour. */
export async function tresorerie(db: TenantDb, coproprieteId: string, avant?: Date): Promise<Tresorerie> {
  const [entrees, sorties, reserve] = await Promise.all([
    db.paiement.aggregate({
      where: { lot: { coproprieteId }, statut: "VALIDE", ...(avant ? { horodatage: { lt: avant } } : {}) },
      _sum: { montant: true },
    }),
    db.depense.findMany({
      where: { coproprieteId, statut: "PAYEE", source: "COMPTE_COURANT" },
      select: { montantTtc: true, payeLe: true, dateDepense: true },
    }),
    avant ? soldeReserveAvant(db, coproprieteId, avant) : soldeFondsReserve(db, coproprieteId).then((r) => ({ solde: r.solde, configuree: r.fondsReserveId !== null })),
  ]);
  const totalEntrees = money(entrees._sum.montant ?? 0);
  const totalSorties = somme(sorties.filter((d) => !avant || (d.payeLe ?? d.dateDepense) < avant).map((d) => money(d.montantTtc)));
  return {
    compte_courant_estime: toApiString(totalEntrees.minus(totalSorties)),
    total_entrees: toApiString(totalEntrees),
    total_sorties_compte_courant: toApiString(totalSorties),
    reserve: toApiString(reserve.solde),
    reserve_configuree: reserve.configuree,
  };
}

async function soldeReserveAvant(db: TenantDb, coproprieteId: string, avant: Date) {
  const fonds = await db.fondsReserve.findUnique({ where: { coproprieteId }, select: { id: true } });
  if (!fonds) return { solde: zero(), configuree: false };
  const agg = await db.fondsReserveMouvement.aggregate({ where: { fondsReserveId: fonds.id, horodatage: { lt: avant } }, _sum: { montant: true } });
  return { solde: money(agg._sum.montant ?? 0), configuree: true };
}

/** Série mensuelle (entrées / sorties / solde cumulé) sur les `nbMois` derniers mois, mois courant inclus. */
export async function tresorerieMensuelle(db: TenantDb, coproprieteId: string, nbMois = 12, maintenant = new Date()) {
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - (nbMois - 1), 1));
  const [avant, paiements, depenses] = await Promise.all([
    tresorerie(db, coproprieteId, debut),
    db.paiement.findMany({ where: { lot: { coproprieteId }, statut: "VALIDE", horodatage: { gte: debut } }, select: { montant: true, horodatage: true } }),
    db.depense.findMany({ where: { coproprieteId, statut: "PAYEE", source: "COMPTE_COURANT" }, select: { montantTtc: true, payeLe: true, dateDepense: true } }),
  ]);
  const mois: { mois: string; entrees: Decimal; sorties: Decimal }[] = [];
  for (let i = 0; i < nbMois; i++) {
    const d = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + i, 1));
    mois.push({ mois: moisDe(d), entrees: zero(), sorties: zero() });
  }
  const index = new Map(mois.map((m, i) => [m.mois, i]));
  for (const p of paiements) {
    const i = index.get(moisDe(p.horodatage));
    if (i !== undefined) mois[i]!.entrees = mois[i]!.entrees.plus(money(p.montant));
  }
  for (const d of depenses) {
    const date = d.payeLe ?? d.dateDepense;
    if (date < debut) continue;
    const i = index.get(moisDe(date));
    if (i !== undefined) mois[i]!.sorties = mois[i]!.sorties.plus(money(d.montantTtc));
  }
  let solde = money(avant.compte_courant_estime);
  return mois.map((m) => {
    solde = solde.plus(m.entrees).minus(m.sorties);
    return { mois: m.mois, entrees: toApiString(m.entrees), sorties: toApiString(m.sorties), solde: toApiString(solde) };
  });
}

// ── Recouvrement ───────────────────────────────────────────────────────────────────────────────

export interface Recouvrement {
  appele: string;
  encaisse: string;
  reste: string;
  taux: string | null; // pourcentage, 1 décimale ; null si rien n'a été appelé
  nb_lignes: number;
}

function recouvrementDe(lignes: { montantDu: Decimal | string; montantPaye: Decimal | string }[]): Recouvrement {
  const appele = somme(lignes.map((l) => money(l.montantDu)));
  const encaisse = somme(lignes.map((l) => money(l.montantPaye)));
  return {
    appele: toApiString(appele),
    encaisse: toApiString(encaisse),
    reste: toApiString(appele.minus(encaisse)),
    taux: appele.isZero() ? null : encaisse.dividedBy(appele).times(100).toDecimalPlaces(1).toString(),
    nb_lignes: lignes.length,
  };
}

/** Recouvrement de l'exercice (appels dont la période « YYYY-MM » commence par l'exercice) et du mois courant. */
export async function recouvrement(db: TenantDb, coproprieteId: string, exercice: string, maintenant = new Date()) {
  const lignes = await db.appelDeFondsLot.findMany({
    where: { appelDeFonds: { coproprieteId, periode: { startsWith: exercice }, statut: { not: "BROUILLON" } } },
    select: { montantDu: true, montantPaye: true, appelDeFonds: { select: { periode: true } } },
  });
  const moisCourant = moisDe(maintenant);
  return {
    exercice: recouvrementDe(lignes),
    periode: { mois: moisCourant, ...recouvrementDe(lignes.filter((l) => l.appelDeFonds.periode === moisCourant)) },
  };
}

// ── Impayés ────────────────────────────────────────────────────────────────────────────────────

export interface LigneImpayee {
  appel_de_fonds_lot_id: string;
  lot_id: string;
  lot_numero: string;
  periode: string;
  type: string;
  date_echeance: string;
  montant_du: string;
  montant_paye: string;
  reste_du: string;
  retard_jours: number;
  tranche: TrancheAnciennete;
  statut: string;
  conteste: boolean;
  niveau_escalade: string;
}

/** Lignes IMPAYE / PARTIEL échues (à la date `maintenant`), avec ancienneté — base des impayés, de l'ageing et du top lots. */
export async function lignesImpayees(db: TenantDb, coproprieteId: string, maintenant = new Date()): Promise<LigneImpayee[]> {
  const lignes = await db.appelDeFondsLot.findMany({
    where: { appelDeFonds: { coproprieteId, statut: { not: "BROUILLON" } }, statut: { in: ["IMPAYE", "PARTIEL"] } },
    select: {
      id: true, lotId: true, montantDu: true, montantPaye: true, statut: true, conteste: true, niveauEscalade: true,
      lot: { select: { numero: true } },
      appelDeFonds: { select: { periode: true, type: true, dateEcheance: true } },
    },
  });
  return lignes
    .filter((l) => l.appelDeFonds.dateEcheance < maintenant)
    .map((l) => {
      const retard = Math.max(0, joursEntre(l.appelDeFonds.dateEcheance, maintenant));
      return {
        appel_de_fonds_lot_id: l.id,
        lot_id: l.lotId,
        lot_numero: l.lot.numero,
        periode: l.appelDeFonds.periode,
        type: l.appelDeFonds.type,
        date_echeance: isoDate(l.appelDeFonds.dateEcheance),
        montant_du: toApiString(l.montantDu),
        montant_paye: toApiString(l.montantPaye),
        reste_du: toApiString(money(l.montantDu).minus(money(l.montantPaye))),
        retard_jours: retard,
        tranche: trancheAnciennete(retard),
        statut: l.statut,
        conteste: l.conteste,
        niveau_escalade: l.niveauEscalade,
      };
    })
    .sort((a, b) => b.retard_jours - a.retard_jours);
}

export function agencerAnciennete(lignes: LigneImpayee[]) {
  const tranches = TRANCHES_ANCIENNETE.map((tranche) => {
    const part = lignes.filter((l) => l.tranche === tranche);
    return { tranche, montant: toApiString(somme(part.map((l) => money(l.reste_du)))), nb_lignes: part.length, nb_lots: new Set(part.map((l) => l.lot_id)).size };
  });
  return {
    total: toApiString(somme(lignes.map((l) => money(l.reste_du)))),
    nb_lots_en_retard: new Set(lignes.map((l) => l.lot_id)).size,
    nb_lignes: lignes.length,
    tranches,
  };
}

/** Impayés agrégés par lot (syndic / conseil / rapport — JAMAIS exposé aux résidents). */
export function impayesParLot(lignes: LigneImpayee[]) {
  const parLot = new Map<string, { lot_id: string; lot_numero: string; reste_du: Decimal; nb_lignes: number; retard_max_jours: number; conteste: boolean }>();
  for (const l of lignes) {
    const e = parLot.get(l.lot_id) ?? { lot_id: l.lot_id, lot_numero: l.lot_numero, reste_du: zero(), nb_lignes: 0, retard_max_jours: 0, conteste: false };
    e.reste_du = e.reste_du.plus(money(l.reste_du));
    e.nb_lignes += 1;
    e.retard_max_jours = Math.max(e.retard_max_jours, l.retard_jours);
    e.conteste = e.conteste || l.conteste;
    parLot.set(l.lot_id, e);
  }
  return [...parLot.values()]
    .sort((a, b) => b.reste_du.comparedTo(a.reste_du))
    .map((e) => ({ ...e, reste_du: toApiString(e.reste_du) }));
}

// ── Dépenses ───────────────────────────────────────────────────────────────────────────────────

export interface DepensePayee {
  id: string;
  libelle: string;
  categorie: string;
  montant_ttc: string;
  source: string;
  date: string;
  prestataire: string | null;
  poste: string | null;
}

/** Dépenses PAYEE de l'exercice (datées par paye_le, repli date_depense) — vue commune syndic / résident (RLS). */
export async function depensesPayees(db: TenantDb, coproprieteId: string, exercice: string): Promise<DepensePayee[]> {
  const rows = await db.depense.findMany({
    where: { coproprieteId, statut: "PAYEE", OR: [{ payeLe: { gte: debutExercice(exercice), lt: finExercice(exercice) } }, { payeLe: null, dateDepense: { gte: debutExercice(exercice), lt: finExercice(exercice) } }] },
    select: { id: true, libelle: true, categorie: true, montantTtc: true, source: true, payeLe: true, dateDepense: true, prestataire: { select: { nom: true } }, budgetPoste: { select: { libelle: true } } },
    orderBy: [{ payeLe: "asc" }, { dateDepense: "asc" }],
  });
  return rows.map((d) => ({
    id: d.id,
    libelle: d.libelle,
    categorie: d.categorie,
    montant_ttc: toApiString(d.montantTtc),
    source: d.source,
    date: isoDate(d.payeLe ?? d.dateDepense),
    prestataire: d.prestataire?.nom ?? null,
    poste: d.budgetPoste?.libelle ?? null,
  }));
}

export function depensesParCategorie(depenses: DepensePayee[], filtre?: (d: DepensePayee) => boolean) {
  const cible = filtre ? depenses.filter(filtre) : depenses;
  const total = somme(cible.map((d) => money(d.montant_ttc)));
  const parCat = new Map<string, { montant: Decimal; nb: number }>();
  for (const d of cible) {
    const e = parCat.get(d.categorie) ?? { montant: zero(), nb: 0 };
    e.montant = e.montant.plus(money(d.montant_ttc));
    e.nb += 1;
    parCat.set(d.categorie, e);
  }
  return {
    total: toApiString(total),
    nb: cible.length,
    categories: [...parCat.entries()]
      .sort((a, b) => b[1].montant.comparedTo(a[1].montant))
      .map(([categorie, e]) => ({ categorie, montant: toApiString(e.montant), nb: e.nb, part: total.isZero() ? null : e.montant.dividedBy(total).times(100).toDecimalPlaces(1).toString() })),
  };
}

// ── Divers indicateurs ─────────────────────────────────────────────────────────────────────────

export async function incidentsOuvertsParUrgence(db: TenantDb, coproprieteId: string) {
  const rows = await db.incident.groupBy({ by: ["urgence"], where: { coproprieteId, statut: { in: ["OUVERT", "EN_COURS"] } }, _count: { _all: true } });
  const par: Record<string, number> = { NORMALE: 0, URGENTE: 0, URGENCE_MAXIMALE: 0 };
  for (const r of rows) par[r.urgence] = r._count._all;
  return { total: rows.reduce((n, r) => n + r._count._all, 0), par_urgence: par };
}

export async function justificatifsEnAttente(db: TenantDb, coproprieteId: string) {
  const agg = await db.justificatifPaiement.aggregate({ where: { coproprieteId, statut: "EN_ATTENTE" }, _sum: { montant: true }, _count: { _all: true } });
  return { nb: agg._count._all, montant: toApiString(agg._sum.montant ?? 0) };
}

/** Faits marquants de l'exercice pour le rapport de gestion : incidents majeurs, AG tenues. Contrats signés : M19. */
export async function faitsMarquants(db: TenantDb, coproprieteId: string, exercice: string) {
  const [incidents, ags, nbIncidents] = await Promise.all([
    db.incident.findMany({
      where: { coproprieteId, urgence: "URGENCE_MAXIMALE", creeLe: { gte: debutExercice(exercice), lt: finExercice(exercice) } },
      select: { id: true, categorie: true, sousCategorie: true, statut: true, creeLe: true },
      orderBy: { creeLe: "asc" },
      take: 20,
    }),
    db.assembleeGenerale.findMany({
      where: { coproprieteId, statut: "CLOTUREE", dateAg: { gte: debutExercice(exercice), lt: finExercice(exercice) } },
      select: { id: true, type: true, dateAg: true, quorumAtteint: true, _count: { select: { resolutions: true } } },
      orderBy: { dateAg: "asc" },
    }),
    db.incident.count({ where: { coproprieteId, creeLe: { gte: debutExercice(exercice), lt: finExercice(exercice) } } }),
  ]);
  return {
    nb_incidents: nbIncidents,
    incidents_majeurs: incidents.map((i) => ({ id: i.id, categorie: i.categorie, sous_categorie: i.sousCategorie, statut: i.statut, date: isoDate(i.creeLe) })),
    ag_tenues: ags.map((a) => ({ id: a.id, type: a.type, date: isoDate(a.dateAg), quorum_atteint: a.quorumAtteint ? a.quorumAtteint.toString() : null, nb_resolutions: a._count.resolutions })),
    // M19 — contrats signés dans l'exercice : rempli quand la table `contrat` existe.
    contrats_signes: [] as { id: string; libelle: string; type: string; date: string }[],
  };
}
