/** Contacts utiles (M21, syndic) — ajout, modification, suppression ; les résidents les voient sur le tableau d'affichage. */
import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { ContactUtile } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Card } from "../../../../../components/ui/card";
import { ContactsGestion } from "../affichage-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").communication.contacts };
}

export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const res = await apiFetch<ContactUtile[]>("/contacts-utiles");
  return (
    <div className="animate-fade mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/${locale}/affichage`} label={dict.communication.titre} />} title={dict.communication.contacts} subtitle={dict.communication.contactsAide} />
      <Card><ContactsGestion dict={dict} locale={ctx.locale} contacts={res.ok ? res.data : []} /></Card>
    </div>
  );
}
