import { cookies, headers } from "next/headers";
import { getDict, isLocale, type Locale } from "../../lib/i18n";
import { HEADER_PATH } from "../../lib/request-info";
import { COOKIE_ACCESS, COOKIE_REFRESH } from "../../lib/session";
import { ButtonLink } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";

/**
 * 404 localisée (A5). `not-found` ne reçoit pas `params` : la langue vient du chemin transmis
 * par le middleware (x-su-path), puis du cookie de langue. Connecté → retour au tableau de bord ;
 * sinon → connexion. Jamais « / » (qui redirige à l'aveugle).
 */
export default async function NotFound() {
  let locale: Locale = "fr";
  let connecte = false;
  try {
    const h = await headers();
    const seg = (h.get(HEADER_PATH) ?? "").split("/")[1] ?? "";
    const jar = await cookies();
    const pref = jar.get("su_locale")?.value ?? "";
    locale = isLocale(seg) ? seg : isLocale(pref) ? pref : "fr";
    connecte = Boolean(jar.get(COOKIE_ACCESS)?.value || jar.get(COOKIE_REFRESH)?.value);
  } catch (e) {
    console.warn(JSON.stringify({ niveau: "warn", message: "404 hors contexte de requete", erreur: String(e) }));
  }
  const dict = getDict(locale);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md animate-in-up">
        <p className="font-poster tnum text-center text-[88px] text-brand">404</p>
        <EmptyState
          title={dict.errors.boundary.notFoundTitle}
          hint={dict.errors.boundary.notFoundBody}
          illustration="empty-search"
          action={
            <ButtonLink href={connecte ? `/${locale}/tableau-de-bord` : `/${locale}/connexion`} size="lg">
              {connecte ? dict.common.backHome : dict.errors.actions.login}
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
