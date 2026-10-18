/**
 * Lecture de plusieurs pages d'une liste — pour les écrans qui FILTRENT sur des critères que
 * l'API ne sait pas encore appliquer (GET /lots, GET /incidents n'acceptent que page + limit ;
 * filtres serveur à venir, API #18). Filtrer la seule page 1 cachait des résultats : on lit
 * jusqu'à `maxPages` pages (limite API : 100 par page) — la page 1, puis les suivantes EN
 * PARALLÈLE d'après meta.total. L'écran sait si la lecture couvre tout (`complete`), sinon il
 * dit « n+ » plutôt qu'un nombre inventé.
 *
 * Une page en échec, quelle qu'elle soit, est un ÉCHEC (l'écran affiche <LoadError>) — jamais
 * une liste tronquée présentée comme partielle.
 * SERVEUR uniquement (apiFetch).
 */
import { apiFetch } from "./client";
import type { ApiResult } from "./types";

export interface Collected<T> {
  rows: T[];
  /** Total annoncé par l'API (meta.total), si fourni. */
  total: number | undefined;
  /** Toutes les lignes existantes ont été lues (rien au-delà du plafond). */
  complete: boolean;
}

export async function collectPages<T>(
  path: string,
  opts: { limit?: number; maxPages?: number; searchParams?: Record<string, string | number | undefined> } = {}
): Promise<ApiResult<Collected<T>>> {
  const limit = opts.limit ?? 100;
  const maxPages = opts.maxPages ?? 5;
  const lire = (page: number) => apiFetch<T[]>(path, { searchParams: { ...opts.searchParams, page, limit } });

  const premiere = await lire(1);
  if (!premiere.ok) return premiere;
  const total = premiere.meta.total;
  const rows: T[] = [...premiere.data];

  if (typeof total === "number") {
    // Pages 2..n connues d'avance : lues en parallèle.
    const pages = Math.min(maxPages, Math.ceil(total / limit));
    const suivantes = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => lire(i + 2)));
    for (const res of suivantes) {
      if (!res.ok) return res;
      rows.push(...res.data);
    }
    return { ok: true, status: 200, data: { rows, total, complete: rows.length >= total }, meta: premiere.meta };
  }

  // Sans total : lecture séquentielle tant que l'API annonce une suite.
  let encore = premiere.meta.has_more ?? premiere.data.length === limit;
  for (let page = 2; encore && page <= maxPages; page++) {
    const res = await lire(page);
    if (!res.ok) return res;
    rows.push(...res.data);
    encore = res.meta.has_more ?? res.data.length === limit;
  }
  return { ok: true, status: 200, data: { rows, total, complete: !encore }, meta: premiere.meta };
}

/** Compteur honnête : « 12 » si la lecture est complète, sinon « 12+ ». */
export function compteHonnete(n: number, complete: boolean, plusTemplate = "{n}+"): string {
  return complete ? String(n) : plusTemplate.replace("{n}", String(n));
}
