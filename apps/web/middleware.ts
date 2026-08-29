/**
 * Middleware — trois responsabilités, dans l'ordre :
 *  1. Localisation : toute URL vit sous /fr/** ou /ar/** ; sinon redirection vers la locale
 *     préférée (cookie su_locale, défaut fr).
 *  2. Garde d'authentification : les pages privées exigent le cookie de session.
 *  3. Rafraîchissement silencieux du JWT : si l'access token expire sous 60 s, on le renouvelle
 *     via POST /auth/refresh et on repose les cookies sur la réponse.
 */
import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["fr", "ar"] as const;
const DEFAULT_LOCALE = "fr";
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001/v1";

const COOKIE_ACCESS = "su_access";
const COOKIE_REFRESH = "su_refresh";
const COOKIE_LOCALE = "su_locale";

/** Préfixes publics (relatifs, après la locale). */
const PUBLIC_PREFIXES = ["/connexion", "/invitation", "/compte"];
export const COOKIE_INVITATION = "su_invitation";

function jwtPayload(token: string): { exp?: number; roles?: Array<{ role?: string }> } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)) as { exp?: number; roles?: Array<{ role?: string }> };
  } catch {
    return null;
  }
}

function jwtExpSeconds(token: string): number | null {
  const exp = jwtPayload(token)?.exp;
  return typeof exp === "number" ? exp : null;
}

/**
 * Périmètre de l'opérateur plateforme (SUPER_ADMIN) : sa console et son compte, rien
 * d'autre — il crée les copropriétés et invite leur syndic ; tout le reste appartient au
 * syndic. Lecture des claims uniquement pour l'aiguillage : l'API revérifie chaque appel.
 */
const PREFIXES_SUPER_ADMIN = ["/admin", "/profil", "/notifications"];

function estSuperAdmin(token: string): boolean {
  return (jwtPayload(token)?.roles ?? []).some((r) => r?.role === "SUPER_ADMIN");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Routes techniques hors localisation : proxys /api/* (cookies lus côté handler) et
  // connexion de développement (404 en production).
  if (pathname.startsWith("/api/") || pathname.startsWith("/dev-login")) {
    return NextResponse.next();
  }

  // 1. Locale
  const seg = pathname.split("/")[1] ?? "";
  if (!LOCALES.includes(seg as (typeof LOCALES)[number])) {
    const preferred = req.cookies.get(COOKIE_LOCALE)?.value;
    const locale = LOCALES.includes(preferred as (typeof LOCALES)[number])
      ? preferred
      : DEFAULT_LOCALE;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  const locale = seg;
  const rest = pathname.slice(locale.length + 1) || "/";

  const isPublic = PUBLIC_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`));

  const access = req.cookies.get(COOKIE_ACCESS)?.value ?? null;
  const refresh = req.cookies.get(COOKIE_REFRESH)?.value ?? null;

  const memoLocale = (res: NextResponse) => {
    res.cookies.set(COOKIE_LOCALE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  };

  if (isPublic) {
    const res = memoLocale(NextResponse.next());
    // Invitation à usage unique (M17) : chaque appareil porte un jeton secret, posé au premier
    // passage sur /invitation ; le premier scan lie le code à ce jeton, les autres sont refusés.
    if (rest.startsWith("/invitation") && !req.cookies.get(COOKIE_INVITATION)?.value) {
      const octets = new Uint8Array(24);
      crypto.getRandomValues(octets);
      const jeton = Array.from(octets, (b) => b.toString(16).padStart(2, "0")).join("");
      res.cookies.set(COOKIE_INVITATION, jeton, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
    return res;
  }

  // 2. Garde d'authentification
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = `/${locale}/connexion`;
  if (!access && !refresh) return memoLocale(NextResponse.redirect(loginUrl));

  // 2b. Opérateur plateforme : toujours ramené dans sa console.
  if (access && estSuperAdmin(access)) {
    const dansPerimetre = PREFIXES_SUPER_ADMIN.some((p) => rest === p || rest.startsWith(`${p}/`));
    if (!dansPerimetre) {
      const consoleUrl = req.nextUrl.clone();
      consoleUrl.pathname = `/${locale}/admin`;
      consoleUrl.search = "";
      return memoLocale(NextResponse.redirect(consoleUrl));
    }
  }

  // 3. Rafraîchissement si le jeton expire sous 60 s (ou est absent)
  const exp = access ? jwtExpSeconds(access) : null;
  const soon = Date.now() / 1000 + 60;
  if ((!access || (exp !== null && exp < soon)) && refresh) {
    try {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
        cache: "no-store",
      });
      if (r.ok) {
        const { data } = (await r.json()) as {
          data: { access_token: string; refresh_token: string; expires_in: number };
        };
        const res = memoLocale(NextResponse.next());
        const secure = process.env.NODE_ENV === "production";
        res.cookies.set(COOKIE_ACCESS, data.access_token, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: Math.max(60, data.expires_in),
        });
        res.cookies.set(COOKIE_REFRESH, data.refresh_token, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
        // Le Server Component de cette même requête doit lire le jeton FRAIS, pas le cookie
        // périmé du navigateur : on réécrit l'en-tête Cookie transmis à l'app.
        const cookieHeader = req.headers
          .get("cookie")!
          .split("; ")
          .map((c) =>
            c.startsWith(`${COOKIE_ACCESS}=`)
              ? `${COOKIE_ACCESS}=${data.access_token}`
              : c.startsWith(`${COOKIE_REFRESH}=`)
                ? `${COOKIE_REFRESH}=${data.refresh_token}`
                : c
          )
          .join("; ");
        const headers = new Headers(req.headers);
        headers.set("cookie", cookieHeader);
        const withHeaders = NextResponse.next({ request: { headers } });
        res.cookies.getAll().forEach((c) => withHeaders.cookies.set(c));
        return withHeaders;
      }
    } catch {
      // API injoignable : on laisse passer, la page affichera l'erreur proprement.
    }
    if (!access) return memoLocale(NextResponse.redirect(loginUrl));
  }

  return memoLocale(NextResponse.next());
}

export const config = {
  // .mjs : worker pdf.js (public/pdf.worker.min.mjs) — actif statique, hors localisation.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|fonts/|icons/|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|webp|ico|mjs)$).*)"],
};
