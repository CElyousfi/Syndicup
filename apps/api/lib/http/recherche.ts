/**
 * Recherche texte des listes (GET /incidents, GET /lots) — motif ILIKE « contient » avec les
 * jokers de l'utilisateur ÉCHAPPÉS : `%` et `_` tapés sont cherchés tels quels, jamais
 * interprétés. Caractère d'échappement `!` (à déclarer `ESCAPE '!'` dans la requête), choisi
 * pour éviter toute ambiguïté avec l'antislash des chaînes JS / SQL.
 */
export const ECHAPPEMENT_ILIKE = "!";

export function motifContient(q: string): string {
  return `%${q.replace(/[!%_]/g, (c) => `${ECHAPPEMENT_ILIKE}${c}`)}%`;
}
