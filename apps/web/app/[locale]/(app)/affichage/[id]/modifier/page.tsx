import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { AnnonceDetail } from "../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { AnnonceForm } from "../../affichage-client";
import { batimentsConnus } from "../../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").communication.modifier };
}

export default async function ModifierAnnoncePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const [res, batiments] = await Promise.all([apiFetch<AnnonceDetail>(`/annonces/${id}`), batimentsConnus()]);
  if (!res.ok) notFound();
  const syndic = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/affichage/${id}`} label={res.data.titre} />} title={dict.communication.modifier} />
      <AnnonceForm dict={dict} locale={ctx.locale} syndic={syndic} batiments={batiments} annonce={res.data} />
    </div>
  );
}
