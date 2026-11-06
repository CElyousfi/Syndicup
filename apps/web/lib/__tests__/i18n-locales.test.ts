import { describe, expect, it } from "vitest";
import { getDict, LOCALES, matchAcceptLanguage, isLocale, langueServeur, languePreferee } from "../i18n";
import { errorsUi } from "../i18n/errors-ui";
import { LOCALE_TABLES } from "../i18n/locales";

type Tree = { [k: string]: string | Tree };
const flat = (o: Tree, p = "", acc: Record<string, string> = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") acc[p + k] = v;
    else flat(v, `${p}${k}.`, acc);
  }
  return acc;
};
const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
const fr = flat(getDict("fr") as unknown as Tree);

describe("langues de l'interface", () => {
  it("chaque langue générée est chargée", () => {
    for (const l of LOCALES) if (l !== "fr" && l !== "ar") expect(LOCALE_TABLES[l], l).toBeTruthy();
  });

  it.each(LOCALES.filter((l) => l !== "fr" && l !== "ar"))("%s (générée) : mêmes clés que le français, mêmes variables, traduit", (l) => {
    const d = flat(getDict(l) as unknown as Tree);
    expect(Object.keys(d).sort()).toEqual(Object.keys(fr).sort());
    for (const k of Object.keys(fr)) expect(vars(d[k]!), `${l} ${k}`).toBe(vars(fr[k]!));
    // Repli français toléré, mais la langue doit être réellement traduite.
    const identiques = Object.keys(fr).filter((k) => d[k] === fr[k] && fr[k]!.length > 15).length;
    expect(identiques / Object.keys(fr).length).toBeLessThan(0.02);
  });

  it.each(LOCALES)("%s : textes d'erreur côté client = dictionnaire", (l) => {
    const e = getDict(l).errors;
    const u = errorsUi(l);
    expect(u.actions).toEqual(e.actions);
    expect(u.boundary).toEqual(e.boundary);
    expect(u.viewer).toEqual(e.viewer);
    expect(u.stale).toEqual(e.stale);
    expect(u.reference).toEqual({ reference: e.reference, referenceCopy: e.referenceCopy, referenceCopied: e.referenceCopied });
  });

  it("Accept-Language → première langue parlée par l'app", () => {
    expect(matchAcceptLanguage("es-ES,es;q=0.9,fr;q=0.8")).toBe("es");
    expect(matchAcceptLanguage("ja,de;q=0.5")).toBe("de");
    expect(matchAcceptLanguage("zh-TW,zh;q=0.9")).toBe("zh");
    expect(matchAcceptLanguage("ja")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });

  it("documents serveur et profil : FR | AR seulement", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(langueServeur("en")).toBe("fr");
    expect(langueServeur("ar")).toBe("ar");
    expect(languePreferee("de")).toBeNull();
    expect(languePreferee("fr")).toBe("FR");
  });
});
