/**
 * Textes des moments difficiles côté client, dans toutes les langues — FR/AR écrits à la main
 * (errors-ui-fr.ts / errors-ui-ar.ts), les autres générés (locales/errors-ui.ts) avec repli
 * texte par texte sur le français. Jamais le dictionnaire complet dans un bundle client.
 */
import * as frUi from "./errors-ui-fr";
import * as arUi from "./errors-ui-ar";
import { ERRORS_UI_L10N } from "./locales/errors-ui";
import { LANG_TAGS, LOCALES, isLocale, type Locale } from "./core";

const FR = {
  actions: frUi.errorActionsFr,
  boundary: frUi.boundaryFr,
  viewer: frUi.viewerFr,
  stale: frUi.staleFr,
  reference: frUi.referenceFr,
};
export type ErrorsUi = typeof FR;
const AR: ErrorsUi = {
  actions: arUi.errorActionsAr,
  boundary: arUi.boundaryAr,
  viewer: arUi.viewerAr,
  stale: arUi.staleAr,
  reference: arUi.referenceAr,
};

type Tree = Record<string, Record<string, string>>;
const cache = new Map<Locale, ErrorsUi>([
  ["fr", FR],
  ["ar", AR],
]);

export function errorsUi(locale: Locale): ErrorsUi {
  let t = cache.get(locale);
  if (!t) {
    const over = (ERRORS_UI_L10N[locale] ?? {}) as Partial<Tree>;
    const out = {} as Record<string, Record<string, string>>;
    for (const [part, texts] of Object.entries(FR as unknown as Tree)) {
      out[part] = {};
      for (const [k, v] of Object.entries(texts)) out[part]![k] = over[part]?.[k]?.trim() ? over[part]![k]! : v;
    }
    t = out as unknown as ErrorsUi;
    cache.set(locale, t);
  }
  return t;
}

/** Langue de la page courante, lue sur <html lang> (composants sans locale en prop). */
export function localeDuDocument(): Locale {
  if (typeof document === "undefined") return "fr";
  const tag = document.documentElement.lang;
  if (isLocale(tag)) return tag;
  return LOCALES.find((l) => LANG_TAGS[l] === tag) ?? "fr";
}
