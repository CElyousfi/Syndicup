import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../../lib/api/client";
import type { DepenseDetail } from "../../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../../components/page-header";
import { DepenseForm } from "../../depense-form";
import { referencesDepense } from "../../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").depenses.modifier };
}

export default async function ModifierDepensePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const d = dict.depenses;
  const res = await apiFetch<DepenseDetail>(`/depenses/${id}`);
  if (!res.ok) notFound();
  const depense = res.data;
  if (depense.statut !== "BROUILLON" && depense.statut !== "REJETEE") redirect(`/${locale}/finances/depenses/${id}`);
  const refs = await referencesDepense(dict, ctx.locale, ctx.coproprieteId, depense.dateDepense.slice(0, 4));
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/finances/depenses/${id}`} label={depense.libelle} />} title={d.modifier} />
      <DepenseForm dict={dict} locale={ctx.locale} postes={refs.postes} prestataires={refs.prestataires} resolutions={refs.resolutions} tvaDefaut={refs.tvaDefaut} depense={depense} />
    </div>
  );
}
