/**
 * État d'accès d'une résidence — CALCULÉ à partir des dates de l'abonnement, à chaque requête :
 * il ne dépend jamais du passage d'un job (un job en panne ne bloque ni ne débloque personne).
 * Fonctions pures, testées sans base (tests/abonnements-etat.test.ts).
 *
 *   OK      → rien à afficher.
 *   RAPPEL  → fenêtre douce : fin d'essai ≤ 7 j, renouvellement ≤ 14 j. Fenêtre refermable (1×/jour).
 *   GRACE   → échéance dépassée, l'app fonctionne encore jusqu'à `date_blocage`. Fenêtre à chaque
 *             ouverture, avec la date de coupure.
 *   BLOQUE  → résidence fermée : écran « service suspendu » pour tout le monde (sauf l'opérateur).
 *
 * Les dates sont des jours calendaires à Casablanca (« AAAA-MM-JJ ») : une échéance au 31 reste
 * valable toute la journée du 31.
 */

export type NiveauAcces = "OK" | "RAPPEL" | "GRACE" | "BLOQUE";

export type EtatAbonnement =
  | "SANS_ABONNEMENT"
  | "EN_ESSAI"
  | "A_JOUR"
  | "RENOUVELLEMENT_PROCHE"
  | "ESSAI_EXPIRE"
  | "EN_RETARD"
  | "ACCES_PROLONGE"
  | "BLOQUE_IMPAYE"
  | "SUSPENDU"
  | "RESILIE";

export const RAPPEL_ESSAI_JOURS = 7;
export const RAPPEL_RENOUVELLEMENT_JOURS = 14;
/** Fenêtre « à traiter » de la console (bien avant que le client voie un rappel). */
export const ALERTE_OPERATEUR_RENOUVELLEMENT_JOURS = 30;

export interface DonneesEtat {
  statut: "ESSAI" | "ACTIF" | "SUSPENDU" | "RESILIE";
  finEssai: Date | string | null;
  finPeriode: Date | string | null;
  delaiGraceJours: number;
  accesProlongeJusquAu: Date | string | null;
}

export interface EtatAcces {
  etat: EtatAbonnement;
  niveau: NiveauAcces;
  /** Échéance de référence : fin d'essai (essai) ou fin de période payée (actif). */
  echeance: string | null;
  /** Jours jusqu'à l'échéance (négatif = dépassée). */
  jours_avant_echeance: number | null;
  /** Dernier jour d'accès avant la coupure automatique (échéance + délai de grâce, ou dérogation). */
  date_blocage: string | null;
  /** Jours jusqu'à la coupure (0 = dernier jour). */
  jours_avant_blocage: number | null;
}

const JOUR_MS = 86_400_000;

/** Jour calendaire « AAAA-MM-JJ » à Casablanca. */
export function jourCasablanca(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Normalise une date de colonne `@db.Date` (minuit UTC) ou une chaîne en « AAAA-MM-JJ ». */
export function jourIso(v: Date | string): string {
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

export function ajouterJours(jour: string, n: number): string {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + n * JOUR_MS).toISOString().slice(0, 10);
}

export function ajouterMois(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  const jourDuMois = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(jourDuMois, dernier));
  return d.toISOString().slice(0, 10);
}

export function ecartJours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR_MS);
}

const maxJour = (a: string, b: string | null) => (b && b > a ? b : a);

export function etatAcces(abo: DonneesEtat | null, maintenant: Date = new Date()): EtatAcces {
  const vide = { echeance: null, jours_avant_echeance: null, date_blocage: null, jours_avant_blocage: null };
  if (!abo) return { etat: "SANS_ABONNEMENT", niveau: "OK", ...vide };
  if (abo.statut === "RESILIE") return { etat: "RESILIE", niveau: "BLOQUE", ...vide };
  // Une suspension manuelle de l'opérateur l'emporte sur toute dérogation.
  if (abo.statut === "SUSPENDU") return { etat: "SUSPENDU", niveau: "BLOQUE", ...vide };

  const aujourdHui = jourCasablanca(maintenant);
  const brute = abo.statut === "ESSAI" ? abo.finEssai : abo.finPeriode;
  if (!brute) return { etat: abo.statut === "ESSAI" ? "EN_ESSAI" : "A_JOUR", niveau: "OK", ...vide };

  const echeance = jourIso(brute);
  const prolonge = abo.accesProlongeJusquAu ? jourIso(abo.accesProlongeJusquAu) : null;
  const dateBlocage = maxJour(ajouterJours(echeance, Math.max(0, abo.delaiGraceJours)), prolonge);
  const avantEcheance = ecartJours(aujourdHui, echeance);
  const avantBlocage = ecartJours(aujourdHui, dateBlocage);
  const base = { echeance, jours_avant_echeance: avantEcheance, date_blocage: dateBlocage, jours_avant_blocage: avantBlocage };

  if (avantEcheance >= 0) {
    if (abo.statut === "ESSAI") {
      return { etat: "EN_ESSAI", niveau: avantEcheance <= RAPPEL_ESSAI_JOURS ? "RAPPEL" : "OK", ...base };
    }
    if (avantEcheance <= ALERTE_OPERATEUR_RENOUVELLEMENT_JOURS) {
      return { etat: "RENOUVELLEMENT_PROCHE", niveau: avantEcheance <= RAPPEL_RENOUVELLEMENT_JOURS ? "RAPPEL" : "OK", ...base };
    }
    return { etat: "A_JOUR", niveau: "OK", ...base };
  }

  if (avantBlocage >= 0) {
    const graceNormale = ajouterJours(echeance, Math.max(0, abo.delaiGraceJours));
    if (prolonge && aujourdHui > graceNormale) return { etat: "ACCES_PROLONGE", niveau: "GRACE", ...base };
    return { etat: abo.statut === "ESSAI" ? "ESSAI_EXPIRE" : "EN_RETARD", niveau: "GRACE", ...base };
  }

  return { etat: "BLOQUE_IMPAYE", niveau: "BLOQUE", ...base };
}
