/**
 * Lecture de plusieurs pages d'une liste — pour les écrans qui filtrent ou comptent sur des
 * critères que l'API ne sait pas encore appliquer (GET /lots, GET /incidents n'acceptent que
 * page + limit). Filtrer la seule page 1 donnait des compteurs et des résultats faux : on lit
 * jusqu'à `maxPages` pages (limite API : 100 par page), et l'écran sait si la lecture est
 * COMPLÈTE — sinon il affiche « 500+ » plutôt qu'un nombre inventé.
 * SERVEUR uniquement (apiFetch).
 */
import { apiFetch } from "./client";
import type { ApiResult } from "./types";

export interface Collected<T> {
  rows: T[];
  /** Total annoncé par l'API (meta.total), si fourni. */
  total: number | undefined;
  /** Toutes les lignes ont été lues (aucune page restante). */
  complete: boolean;
}

export async function collectPages<T>(
  path: string,
  opts: { limit?: number; maxPages?: number; searchParams?: Record<string, string | number | undefined> } = {}
): Promise<ApiResult<Collected<T>>> {
  const limit = opts.limit ?? 100;
  const maxPages = opts.maxPages ?? 5;
  const rows: T[] = [];
  let total: number | undefined;
  for (let page = 1; page <= maxPages; page++) {
    const res = await apiFetch<T[]>(path, { searchParams: { ...opts.searchParams, page, limit } });
    if (!res.ok) {
      // Première page en échec : l'écran affiche <LoadError>. Plus loin : on garde ce qui est lu,
      // marqué incomplet (compteurs « n+ »), jamais un échec silencieux.
      if (page === 1) return res;
      console.warn(JSON.stringify({ niveau: "warn", message: "lecture paginee interrompue", chemin: path, page, code: res.error.code }));
      return { ok: true, status: 200, data: { rows, total, complete: false }, meta: { request_id: "" } };
    }
    rows.push(...res.data);
    total = res.meta.total ?? total;
    const encore = res.meta.has_more ?? res.data.length === limit;
    if (!encore) return { ok: true, status: 200, data: { rows, total, complete: true }, meta: res.meta };
  }
  return { ok: true, status: 200, data: { rows, total, complete: false }, meta: { request_id: "" } };
}

/** Compteur honnête : « 12 » si la lecture est complète, sinon « 12+ ». */
export function compteHonnete(n: number, complete: boolean, plusTemplate = "{n}+"): string {
  return complete ? String(n) : plusTemplate.replace("{n}", String(n));
}
