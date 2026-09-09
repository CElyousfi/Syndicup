/**
 * Hook d'instrumentation Next 15 — exécuté une fois au démarrage du serveur.
 *  1. Valide la configuration d'environnement (lib/config/env.ts) : un déploiement mal configuré
 *     échoue ici, avant la première requête (Render garde alors l'ancienne version en ligne).
 *  2. Initialise Sentry uniquement si SENTRY_DSN est défini (seam M0).
 * Le `if` sur NEXT_RUNTIME (remplacé à la compilation) garde ces imports Node hors du bundle edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validerEnvironnement } = await import("./lib/config/env");
    validerEnvironnement();
    if (process.env.SENTRY_DSN) {
      const { initSentry } = await import("./lib/observability/sentry");
      await initSentry();
    }
  }
}
