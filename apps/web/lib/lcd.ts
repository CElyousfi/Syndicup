/**
 * Aides du module Location courte durée (M15) — lecture de rôle et calculs d'affichage.
 * Aucune règle métier ici : l'API est l'autorité (régime, quotas, délais).
 */
import type { AppContext } from "./app-context";
import type { LcdSejour } from "./api/types";

export type VueLcd = "gestion" | "conseil" | "gardien" | "resident" | "gestionnaire" | "aucune";

/** Vue du module selon le rôle principal (résolue côté serveur, jamais par masquage client). */
export function vueLcd(ctx: AppContext): VueLcd {
  const a = (r: string) => ctx.roles.includes(r as never);
  if (a("SYNDIC") || a("SUPER_ADMIN")) return "gestion";
  if (a("PROPRIETAIRE") || a("INDIVISAIRE") || a("PERSONNE_MORALE_REPRESENTANT")) return "resident";
  if (a("GESTIONNAIRE_LCD")) return "gestionnaire";
  if (a("CONSEIL_SYNDICAL")) return "conseil";
  if (a("GARDIEN")) return "gardien";
  return "aucune";
}

/** Nombre de nuits entre deux dates ISO (minuit UTC) — affichage uniquement. */
export function nbNuits(arrivee: string, depart: string): number {
  const a = new Date(arrivee).getTime();
  const d = new Date(depart).getTime();
  if (Number.isNaN(a) || Number.isNaN(d)) return 0;
  return Math.max(0, Math.round((d - a) / 86_400_000));
}

/** "2026-09-04T00:00:00.000Z" → "2026-09-04" (valeur d'un <input type="date">). */
export function dateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Tri : séjours en cours d'abord, puis prévus (les plus proches en tête), puis le reste. */
export function trierSejours(sejours: LcdSejour[]): LcdSejour[] {
  const poids = { EN_COURS: 0, PREVU: 1, TERMINE: 2, ANNULE: 3 } as const;
  return [...sejours].sort((x, y) => {
    const d = poids[x.statut] - poids[y.statut];
    if (d !== 0) return d;
    return x.statut === "PREVU"
      ? x.dateArrivee.localeCompare(y.dateArrivee)
      : y.dateArrivee.localeCompare(x.dateArrivee);
  });
}
