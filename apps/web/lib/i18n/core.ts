/**
 * Langues de l'interface — module sans dictionnaire, importable côté client (sélecteur de
 * langue, `fill`, types). Les dictionnaires vivent dans ./index.ts (serveur).
 *
 * Français = langue de référence (fr.ts), arabe écrit à la main (ar.ts, RTL). Les autres langues
 * sont des fichiers JSON (./locales/<code>.json) générés par scripts/i18n/build.py ; un texte
 * absent retombe sur le français. Les documents à valeur probante (PDF, e-mails, convocations,
 * notifications envoyées par le serveur) restent en français ou en arabe : `langue_preferee` du
 * profil (FR | AR) n'a que ces deux valeurs.
 */
import type { fr } from "./fr";

/** Forme du dictionnaire (français = référence) — type seul, rien n'est chargé côté client. */
export type Dict = typeof fr;

export const LOCALES = ["fr", "ar", "en", "es", "it", "de", "nl", "pt", "ru", "tr", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

/** Nom de chaque langue dans sa propre langue (sélecteur). */
export const LANG_NAMES: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
  nl: "Nederlands",
  pt: "Português",
  ru: "Русский",
  tr: "Türkçe",
  zh: "简体中文",
};

/** Drapeau affiché à côté du nom (pays le plus associé à la langue ; l'arabe : le Maroc). */
export const LANG_FLAGS: Record<Locale, string> = {
  fr: "🇫🇷",
  ar: "🇲🇦",
  en: "🇬🇧",
  es: "🇪🇸",
  it: "🇮🇹",
  de: "🇩🇪",
  nl: "🇳🇱",
  pt: "🇵🇹",
  ru: "🇷🇺",
  tr: "🇹🇷",
  zh: "🇨🇳",
};

/** Balise BCP 47 de chaque langue (attribut lang, Intl). */
export const LANG_TAGS: Record<Locale, string> = {
  fr: "fr",
  ar: "ar",
  en: "en",
  es: "es",
  it: "it",
  de: "de",
  nl: "nl",
  pt: "pt-PT",
  ru: "ru",
  tr: "tr",
  zh: "zh-Hans",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Langue des contenus produits par le serveur (PDF, CSV, e-mails, Dari) : arabe si l'interface
 * est en arabe, français sinon.
 */
export function langueServeur(locale: Locale): "fr" | "ar" {
  return locale === "ar" ? "ar" : "fr";
}

/** Valeur de `langue_preferee` (profil) correspondant à une langue d'interface, ou null. */
export function languePreferee(locale: Locale): "FR" | "AR" | null {
  return locale === "ar" ? "AR" : locale === "fr" ? "FR" : null;
}

/** Première langue proposée par le navigateur (en-tête Accept-Language) que l'app parle. */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((p) => {
      const [tag = "", ...params] = p.trim().split(";");
      const q = params.map((x) => x.trim()).find((x) => x.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number.parseFloat(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split("-")[0] ?? "";
    if (base === "zh" && /-(hant|tw|hk|mo)\b/.test(tag)) continue; // chinois traditionnel : non proposé
    if (isLocale(base)) return base;
  }
  return null;
}

/** Interpolation simple : fill("Bonjour {nom}", { nom: "Amina" }). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] === undefined ? `{${k}}` : String(vars[k])
  );
}
