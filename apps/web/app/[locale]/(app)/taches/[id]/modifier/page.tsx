import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { TacheDetail } from "../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { TacheForm } from "../../taches-client";
import { assigneesPossibles } from "../../references";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").taches.modifier };
}

export default async function ModifierTachePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const [res, assignees] = await Promise.all([apiFetch<TacheDetail>(`/taches/${id}`), assigneesPossibles()]);
  if (!res.ok) notFound();
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/taches/${id}`} label={res.data.titre} />} title={dict.taches.modifier} />
      <TacheForm dict={dict} locale={ctx.locale} assignees={assignees} tache={res.data} />
    </div>
  );
}
