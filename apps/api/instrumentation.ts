/**
 * Hook d'instrumentation Next 15 — exécuté une fois au démarrage du serveur.
 * Initialise Sentry uniquement si SENTRY_DSN est défini (seam M0).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const { initSentry } = await import("./lib/observability/sentry");
    await initSentry();
  }
}
