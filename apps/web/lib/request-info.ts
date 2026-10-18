/**
 * Informations sur la requête en cours, CÔTÉ SERVEUR uniquement (Server Components, Server
 * Actions, Route Handlers) : langue et chemin courant. Le middleware pose `x-su-path` sur
 * chaque requête localisée (pages ET Server Actions, qui postent sur l'URL de la page) ;
 * repli : cookie de langue, puis en-tête Referer.
 *
 * Sert à parler à l'utilisateur dans SA langue quand une erreur survient loin de l'écran
 * (client API, Server Action), et à le ramener exactement où il était après reconnexion.
 */
import { cookies, headers } from "next/headers";
import { getDict, isLocale, type Dict, type Locale } from "./i18n";

export const HEADER_PATH = "x-su-path";
const COOKIE_LOCALE = "su_locale";

/** Chemin complet de la requête (« /fr/incidents/42?onglet=x »), ou null hors requête. */
async function fullPath(): Promise<string | null> {
  try {
    const h = await headers();
    const direct = h.get(HEADER_PATH);
    if (direct) return direct;
    const referer = h.get("referer");
    if (referer) {
      const u = new URL(referer);
      return u.pathname + u.search;
    }
  } catch {
    // Hors contexte de requête (tests, build) : aucun chemin connu.
  }
  return null;
}

export async function requestLocale(): Promise<Locale> {
  const path = await fullPath();
  const seg = path?.split("/")[1] ?? "";
  if (isLocale(seg)) return seg;
  try {
    const v = (await cookies()).get(COOKIE_LOCALE)?.value ?? "";
    if (isLocale(v)) return v;
  } catch {
    // hors requête
  }
  return "fr";
}

export async function requestDict(): Promise<Dict> {
  return getDict(await requestLocale());
}

/**
 * Chemin courant SANS le préfixe de langue (« /incidents/42?onglet=x »), tel que l'attend le
 * paramètre `next` de /connexion. Jamais la page de connexion elle-même.
 */
export async function currentPathWithoutLocale(): Promise<string | null> {
  const path = await fullPath();
  if (!path) return null;
  const seg = path.split("/")[1] ?? "";
  const rest = isLocale(seg) ? path.slice(seg.length + 1) || "/" : path;
  if (!rest.startsWith("/") || rest.startsWith("//") || rest.startsWith("/connexion")) return null;
  return rest;
}

/** Lien de reconnexion qui ramène sur la page courante. */
export async function loginHref(locale: Locale): Promise<string> {
  const next = await currentPathWithoutLocale();
  return `/${locale}/connexion${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
}
