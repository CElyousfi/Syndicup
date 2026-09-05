/**
 * Pagination et tri partagés des endpoints de liste — M16 (réutilisé M16→M25).
 * `page`/`limit` bornés (1..100), tri restreint à une liste blanche de champs (jamais un nom de
 * colonne libre injecté dans l'ORDER BY), sens `asc`/`desc`.
 */
export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function lirePagination(url: URL, defauts: { limit?: number; max?: number } = {}): Pagination {
  const max = defauts.max ?? 100;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(max, Math.max(1, Number(url.searchParams.get("limit") ?? defauts.limit ?? 20) || (defauts.limit ?? 20)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function metaPagination(total: number, p: Pagination) {
  return { total, page: p.page, has_more: p.page * p.limit < total };
}

export interface Tri<T extends string> {
  champ: T;
  sens: "asc" | "desc";
}

/** `?sort=champ` ou `?sort=-champ` (préfixe « - » = décroissant) — champ hors liste blanche = défaut. */
export function lireTri<T extends string>(url: URL, autorises: readonly T[], defaut: Tri<T>): Tri<T> {
  const brut = url.searchParams.get("sort");
  if (!brut) return defaut;
  const sens: "asc" | "desc" = brut.startsWith("-") ? "desc" : "asc";
  const champ = brut.replace(/^-/, "");
  return (autorises as readonly string[]).includes(champ) ? { champ: champ as T, sens } : defaut;
}
