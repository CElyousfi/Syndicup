/**
 * Drapeaux clients — interrupteurs de PRÉSENTATION lus par le web et le mobile via
 * GET /v1/config/client. Lus depuis l'environnement (Render) à chaque requête : changer la
 * variable puis redémarrer le service suffit, aucune base, aucune migration.
 *
 * Règle : jamais de secret ni de logique métier ici — uniquement des booléens d'interface que
 * n'importe qui peut lire. Un drapeau absent ou mal saisi vaut sa valeur par défaut.
 */

export interface ClientFlags {
  /** Couche « Alive » (mouvement, haptique, sons — docs/ALIVE_AUDIT.md). Défaut : activée. */
  alive_v1: boolean;
}

/** Valeurs par défaut — aussi celles qu'un client neuf applique sans réponse du serveur. */
export const DEFAULT_CLIENT_FLAGS: ClientFlags = { alive_v1: true };

function booleen(v: string | undefined, defaut: boolean): boolean {
  const s = v?.trim().toLowerCase();
  if (s === "true" || s === "1" || s === "on") return true;
  if (s === "false" || s === "0" || s === "off") return false;
  return defaut;
}

export function clientFlags(env: Record<string, string | undefined> = process.env): ClientFlags {
  return {
    alive_v1: booleen(env.ALIVE_V1, DEFAULT_CLIENT_FLAGS.alive_v1),
  };
}
