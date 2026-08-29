/**
 * i18n minimaliste et typé — la langue vient du segment d'URL /{locale}/ (fr | ar), alignée
 * ensuite sur `langue_preferee` du profil. Zéro dépendance : dictionnaires TS, RTL par `dir`.
 */
import { fr } from "./fr";
import { ar } from "./ar";

export type Locale = "fr" | "ar";
export type Dict = typeof fr;

export const LOCALES: Locale[] = ["fr", "ar"];
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: string): value is Locale {
  return value === "fr" || value === "ar";
}

export function getDict(locale: Locale): Dict {
  return locale === "ar" ? ar : fr;
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Interpolation simple : t("Bonjour {nom}", { nom: "Amina" }). */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] === undefined ? `{${k}}` : String(vars[k])
  );
}
