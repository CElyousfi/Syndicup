import { getDict, isLocale, type Locale } from "../../../../../lib/i18n";
import { seDeconnecter } from "../../../../../lib/actions/session-actions";
import { ButtonLink } from "../../../../../components/ui/button";
import { IconCircle, CKey } from "../../../../../components/ui/color-icons";

/** Session valide mais aucun rôle : il manque une invitation acceptée. */
export default async function SansAccesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);
  return (
    <div className="card px-6 py-10 text-center">
      <IconCircle tone="sand" size={72} className="mx-auto">
        <CKey width={32} height={32} />
      </IconCircle>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">{dict.auth.inviteTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-soft">{dict.auth.inviteSignInFirst}</p>
      <div className="mt-7 space-y-3">
        <ButtonLink href={`/${locale}/invitation`} size="lg" className="w-full">
          {dict.auth.inviteEnterCode}
        </ButtonLink>
        <form action={seDeconnecter}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="text-[13px] font-medium text-soft hover:text-ink-strong">
            {dict.common.logout}
          </button>
        </form>
      </div>
    </div>
  );
}
