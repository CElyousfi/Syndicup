import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Banner } from "../../../../../../components/ui/banner";
import { DepenseForm } from "../depense-form";
import { referencesDepense } from "../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").depenses.nouvelle };
}

export default async function NouvelleDepensePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const d = dict.depenses;
  const refs = await referencesDepense(dict, ctx.locale, ctx.coproprieteId, String(new Date().getFullYear()));
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/finances/depenses`} label={d.titre} />} title={d.nouvelle} subtitle={d.creeeAide} />
      {!refs.budgetActif ? <Banner variant="warn" className="mb-4">{d.aucunBudgetActif}</Banner> : null}
      <DepenseForm dict={dict} locale={ctx.locale} postes={refs.postes} prestataires={refs.prestataires} resolutions={refs.resolutions} tvaDefaut={refs.tvaDefaut} />
    </div>
  );
}
