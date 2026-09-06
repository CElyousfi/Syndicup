import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { ContratDetail } from "../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { ContratForm } from "../../contrat-form";
import { referencesContrat } from "../../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").contrats.modifier };
}

export default async function ModifierContratPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const [res, refs] = await Promise.all([apiFetch<ContratDetail>(`/contrats/${id}`), referencesContrat(dict, ctx.locale, ctx.coproprieteId)]);
  if (!res.ok) notFound();
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/contrats/${id}`} label={res.data.libelle} />} title={dict.contrats.modifier} />
      <ContratForm dict={dict} locale={ctx.locale} postes={refs.postes} prestataires={refs.prestataires} resolutions={refs.resolutions} seuilAg={refs.seuilAg} contrat={res.data} />
    </div>
  );
}
