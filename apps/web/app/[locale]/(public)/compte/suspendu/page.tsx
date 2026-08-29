import { getDict, isLocale, type Locale } from "../../../../../lib/i18n";
import { IconCircle, CAlert } from "../../../../../components/ui/color-icons";
import { EtatCompte } from "../../../../../components/etat-compte";

export default async function SuspenduPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "fr";
  const dict = getDict(locale);
  return (
    <EtatCompte
      icone={
        <IconCircle tone="danger" size={72}>
          <CAlert width={32} height={32} />
        </IconCircle>
      }
      titre={dict.auth.suspendedTitle}
      corps={dict.auth.suspendedBody}
      locale={locale}
      deconnexion={dict.common.logout}
    />
  );
}
