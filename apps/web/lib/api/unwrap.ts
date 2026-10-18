/**
 * Un chargement en échec ne doit JAMAIS ressembler à « rien ici ». `res.ok ? res.data : []`
 * transformait une panne en liste vide (et un solde en « 0 MAD — Payé ») : ces aides gardent
 * la différence entre « vide » et « indisponible », pour que l'écran affiche <LoadError>.
 */
import type { ApiResult } from "./types";

export interface LoadFailure {
  code: string;
  status: number;
  message: string;
  requestId?: string;
  retryAfter?: number;
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: LoadFailure };

export function failureOf(res: Extract<ApiResult<unknown>, { ok: false }>): LoadFailure {
  return {
    code: res.error.code,
    status: res.status,
    message: res.error.message,
    requestId: res.requestId,
    retryAfter: res.retryAfter,
  };
}

/** Réponse API → données OU échec explicite (jamais un tableau vide inventé). */
export function unwrap<T>(res: ApiResult<T>): Loaded<T> {
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: failureOf(res) };
}

/** Alias lisible pour les listes. */
export const unwrapList = unwrap;

/**
 * Refus PAR CONCEPTION (403) : la ressource ne concerne pas ce rôle (ex. le comptable d'un
 * cabinet et les AG, le représentant d'une personne morale et les espaces communs — matrice
 * apps/api/lib/auth/permissions.ts). Ce n'est pas une panne : jamais « Réessayer ».
 */
export function isRefused(res: ApiResult<unknown> | null | undefined): boolean {
  return !!res && !res.ok && res.status === 403;
}

/**
 * Réponse optionnelle : appel non fait pour ce rôle (`null`) OU refusé par conception (403)
 * → vide légitime `{ ok: true, data: empty }`. Les autres échecs restent des échecs.
 * Pour une section qui n'a pas de sens pour le rôle, préférer `isRefused()` et MASQUER la
 * section (pas une tuile vide ni un zéro).
 */
export function unwrapOptional<T>(res: ApiResult<T> | null | undefined, empty: T): Loaded<T> {
  if (!res || isRefused(res)) return { ok: true, data: empty };
  return unwrap(res);
}

/** Données d'un résultat chargé, ou la valeur de repli (pour les dérivations de page). */
export function dataOr<T>(l: Loaded<T>, fallback: T): T {
  return l.ok ? l.data : fallback;
}

/** Premier échec d'une série de chargements (pour un seul bandeau « indisponible »). */
export function firstFailure(...ls: Array<Loaded<unknown> | null | undefined>): LoadFailure | null {
  for (const l of ls) if (l && !l.ok) return l.error;
  return null;
}
