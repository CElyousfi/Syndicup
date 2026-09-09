/** Hook Next 15 — valide la configuration (lib/config/env.ts) une fois au démarrage du serveur Node. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validerEnvironnementWeb } = await import("./lib/config/env");
    validerEnvironnementWeb();
  }
}
