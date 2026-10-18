/**
 * Erreur récupérable du stockage de fichiers (Supabase Storage) : panne réseau, quota, bucket
 * momentanément injoignable. Mappée par withApiHandler en 503 SERVICE_UNAVAILABLE + Retry-After
 * — l'utilisateur peut réessayer ; ce n'est pas un bug applicatif.
 *
 * `message` est destiné à l'utilisateur ; `detail` (message brut du fournisseur) reste côté logs.
 */
export class StockageIndisponibleError extends Error {
  constructor(public readonly detail: string) {
    super("Le stockage des fichiers est momentanément indisponible. Réessayez dans quelques instants.");
    this.name = "StockageIndisponibleError";
  }
}
