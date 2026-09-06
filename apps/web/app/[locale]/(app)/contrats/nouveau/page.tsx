import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { ContratForm } from "../contrat-form";
import { referencesContrat } from "../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").contrats.nouveau };
}

export default async function NouveauContratPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const refs = await referencesContrat(dict, ctx.locale, ctx.coproprieteId);
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/contrats`} label={dict.contrats.titre} />} title={dict.contrats.nouveau} subtitle={dict.contrats.creeAide} />
      <ContratForm dict={dict} locale={ctx.locale} postes={refs.postes} prestataires={refs.prestataires} resolutions={refs.resolutions} seuilAg={refs.seuilAg} />
    </div>
  );
}
