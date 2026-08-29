import { getDict, isLocale, type Locale } from "../../../../../lib/i18n";
import { IconCircle, CHandshake } from "../../../../../components/ui/color-icons";
import { EtatCompte } from "../../../../../components/etat-compte";

export default async function ValidationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);
  return (
    <EtatCompte
      icone={
        <IconCircle tone="warn" size={72}>
          <CHandshake width={32} height={32} />
        </IconCircle>
      }
      titre={dict.auth.validationTitle}
      corps={dict.auth.validationBody}
      locale={locale}
      deconnexion={dict.common.logout}
    />
  );
}
