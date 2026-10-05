import { getDict, isLocale, type Locale } from "../../../../../lib/i18n";
import { seDeconnecter } from "../../../../../lib/actions/session-actions";
import { Button, ButtonLink } from "../../../../../components/ui/button";
import { IconCircle, CKey } from "../../../../../components/ui/color-icons";

/** Session valide mais aucun rôle : il manque une invitation acceptée. */
export default async function SansAccesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);
  return (
    <div className="text-center">
      <IconCircle tone="sand" size={72} className="mx-auto">
        <CKey width={32} height={32} />
      </IconCircle>
      <h1 className="mt-6 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-ink">{dict.auth.inviteTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-soft">{dict.auth.inviteSignInFirst}</p>
      <div className="mt-8 space-y-3">
        <ButtonLink href={`/${locale}/invitation`} size="lg" className="w-full">
          {dict.auth.inviteEnterCode}
        </ButtonLink>
        <form action={seDeconnecter}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost" size="lg" className="w-full">
            {dict.common.logout}
          </Button>
        </form>
      </div>
    </div>
  );
}
