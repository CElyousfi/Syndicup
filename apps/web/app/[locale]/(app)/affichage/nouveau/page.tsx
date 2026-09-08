import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { AnnonceForm } from "../affichage-client";
import { batimentsConnus } from "../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").communication.nouvelle };
}

export default async function NouvelleAnnoncePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/affichage`} label={dict.communication.titre} />} title={dict.communication.nouvelle} subtitle={dict.communication.nouvelleAide} />
      <AnnonceForm dict={dict} locale={ctx.locale} syndic={syndic} batiments={await batimentsConnus()} />
    </div>
  );
}
