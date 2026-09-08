import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { TacheForm } from "../taches-client";
import { assigneesPossibles } from "../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").taches.nouvelle };
}

export default async function NouvelleTachePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/taches`} label={dict.taches.titre} />} title={dict.taches.nouvelle} subtitle={dict.taches.nouvelleAide} />
      <TacheForm dict={dict} locale={ctx.locale} assignees={await assigneesPossibles()} />
    </div>
  );
}
