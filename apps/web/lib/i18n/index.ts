/**
 * i18n minimaliste et typé — la langue vient du segment d'URL /{locale}/ (voir ./core.ts pour la
 * liste), alignée ensuite sur `langue_preferee` du profil pour FR/AR. Zéro dépendance :
 * dictionnaires TS (fr, ar) + JSON générés pour les autres langues, RTL par `dir`.
 *
 * Côté client, importer depuis "./core" (fill, types, noms des langues) : ce module-ci charge
 * tous les dictionnaires.
 */
import { fr } from "./fr";
import { ar } from "./ar";
import { LOCALE_TABLES } from "./locales";
import type { Dict, Locale } from "./core";

export * from "./core";

type Tree = { [k: string]: string | Tree };

/** Dictionnaire complet : chaque texte traduit remplace le français, les autres restent en français. */
function merge(base: Tree, over: Tree | undefined): Tree {
  if (!over) return base;
  const out: Tree = {};
  for (const [k, v] of Object.entries(base)) {
    const o = over[k];
    if (typeof v === "string") out[k] = typeof o === "string" && o.trim() ? o : v;
    else out[k] = merge(v, typeof o === "object" ? o : undefined);
  }
  return out;
}

const cache = new Map<Locale, Dict>([
  ["fr", fr],
  ["ar", ar as unknown as Dict],
]);

export function getDict(locale: Locale): Dict {
  let d = cache.get(locale);
  if (!d) {
    d = merge(fr as unknown as Tree, LOCALE_TABLES[locale] as Tree | undefined) as unknown as Dict;
    cache.set(locale, d);
  }
  return d;
}
