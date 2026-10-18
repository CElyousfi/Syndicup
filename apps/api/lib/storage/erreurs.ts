/**
 * Erreur récupérable du stockage de fichiers (Supabase Storage) : panne réseau, 5xx, 429.
 * Mappée par withApiHandler en 503 SERVICE_UNAVAILABLE + Retry-After (et remontée à Sentry).
 * Un 4xx (objet absent, chemin invalide, droits) n'en est PAS une : c'est une erreur ordinaire
 * (500 + Sentry) — un bug à corriger, pas une panne à réessayer.
 *
 * `message` est destiné à l'utilisateur ; `detail` (message brut du fournisseur) reste côté logs.
 */
export class StockageIndisponibleError extends Error {
  constructor(public readonly detail: string) {
    super("Le stockage des fichiers est momentanément indisponible. Réessayez dans quelques instants.");
    this.name = "StockageIndisponibleError";
  }
}

/**
 * Vrai si l'erreur du client Storage est une panne récupérable : échec réseau (StorageUnknownError,
 * aucun statut HTTP) ou statut ≥ 500 / 429. Supabase renvoie parfois HTTP 400 avec un statusCode
 * « 404 » dans le corps (objet absent) : les deux champs sont lus, tout 4xx (hors 429) l'emporte.
 */
export function estPanneStockage(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const codes = [status, statusCode].map((c) => Number(c)).filter((c) => Number.isFinite(c) && c > 0);
  if (codes.length === 0) return true; // pas de réponse HTTP : réseau / DNS / timeout
  if (codes.some((c) => c >= 400 && c < 500 && c !== 429)) return false;
  return codes.some((c) => c >= 500 || c === 429);
}

/** Erreur à lever pour un échec Storage : 503 récupérable si panne, sinon Error ordinaire. */
export function erreurStockage(operation: string, error: unknown): Error {
  const message = (error as { message?: unknown } | null)?.message;
  const detail = `${operation} : ${typeof message === "string" ? message : "inconnu"}`;
  return estPanneStockage(error) ? new StockageIndisponibleError(detail) : new Error(`Échec Storage — ${detail}`);
}
