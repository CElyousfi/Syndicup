/**
 * Calcul pur des échéances d'un contrat — M19. Aucune E/S : dates civiles UTC, périodicité,
 * horizon, préavis. Règle des fins de mois : une échéance mensuelle prise le 31 tombe le dernier
 * jour des mois plus courts (31/01 → 28/02 → 31/03), la date « ancre » restant celle du contrat.
 */
import type { Periodicite, TypeEcheance } from "./schemas";

export const MOIS_PAR_PERIODICITE: Record<Exclude<Periodicite, "PONCTUELLE">, number> = { MENSUELLE: 1, TRIMESTRIELLE: 3, SEMESTRIELLE: 6, ANNUELLE: 12 };

export function jourUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
export function dateUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
/** Ajoute `n` mois à `ancre` en conservant le jour, borné au dernier jour du mois cible. */
export function ajouterMois(ancre: Date, n: number): Date {
  const y = ancre.getUTCFullYear(), m = ancre.getUTCMonth() + n, jour = ancre.getUTCDate();
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(jour, dim)));
}

export interface EcheanceCalculee {
  type: TypeEcheance;
  date: Date;
  montant: string | null;
}

/**
 * Échéances de PAIEMENT entre `aPartirDe` (inclus) et `horizon` (inclus), bornées par `dateFin`,
 * calées sur `dateDebut` (ancre) ; PONCTUELLE = une seule échéance à `dateDebut`.
 * + une échéance RENOUVELLEMENT à `dateFin − preavisJours` (si les deux sont connus et ≥ aPartirDe).
 */
export function calculerEcheances(p: { dateDebut: Date; dateFin: Date | null; periodicite: Periodicite; montantPeriode: string | null; preavisJours: number | null; aPartirDe: Date; horizon: Date }): EcheanceCalculee[] {
  const debut = jourUtc(p.dateDebut);
  const fin = p.dateFin ? jourUtc(p.dateFin) : null;
  const depuis = jourUtc(p.aPartirDe);
  const horizon = jourUtc(p.horizon);
  const out: EcheanceCalculee[] = [];
  const dansFenetre = (d: Date) => d >= depuis && d <= horizon && (!fin || d <= fin);
  if (p.periodicite === "PONCTUELLE") {
    if (dansFenetre(debut)) out.push({ type: "PAIEMENT", date: debut, montant: p.montantPeriode });
  } else {
    const pas = MOIS_PAR_PERIODICITE[p.periodicite];
    for (let i = 0; i < 400; i++) {
      const d = ajouterMois(debut, i * pas);
      if (d > horizon || (fin && d > fin)) break;
      if (d >= depuis) out.push({ type: "PAIEMENT", date: d, montant: p.montantPeriode });
    }
  }
  if (fin && p.preavisJours !== null && p.preavisJours !== undefined) {
    const renouvellement = ajouterJours(fin, -p.preavisJours);
    if (renouvellement >= depuis && !out.some((e) => e.type === "RENOUVELLEMENT")) out.push({ type: "RENOUVELLEMENT", date: renouvellement, montant: null });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Durée (en mois calendaires, ≥ 1) d'une période contractuelle `dateDebut → dateFin` (fin INCLUSE :
 * 01/01 → 31/12 = 12 mois) — base de la reconduction tacite.
 */
export function dureeEnMois(dateDebut: Date, dateFin: Date): number {
  const a = jourUtc(dateDebut), b = ajouterJours(jourUtc(dateFin), 1);
  const mois = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() >= a.getUTCDate() ? 0 : -1);
  return Math.max(1, mois);
}
