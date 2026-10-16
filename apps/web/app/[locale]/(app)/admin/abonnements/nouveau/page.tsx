import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { ClientFacturation, ResidenceAdmin } from "../../../../../../lib/api/console-types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { NouvelAbonnementForm } from "./nouvel-abonnement-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").console.nouveauTitre };
}

export default async function NouvelAbonnementPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ copropriete?: string; client?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SUPER_ADMIN"]);
  const { dict } = ctx;
  const c = dict.console;
  const [clients, residences] = await Promise.all([
    apiFetch<ClientFacturation[]>("/admin/clients"),
    apiFetch<ResidenceAdmin[]>("/admin/coproprietes"),
  ]);
  const aujourdHui = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());

  return (
    <div className="page-root">
      <PageHeader back={<BackLink href={`/${ctx.locale}/admin/abonnements`} label={c.nav.abonnements} />} title={c.nouveauTitre} subtitle={c.nouveauSousTitre} />
      <NouvelAbonnementForm
        dict={dict}
        locale={ctx.locale}
        clients={clients.ok ? clients.data : []}
        residences={(residences.ok ? residences.data : []).filter((r) => r.statut === "ACTIVE")}
        preselection={sp.copropriete ?? null}
        clientPreselectionne={sp.client ?? null}
        aujourdHui={aujourdHui}
      />
    </div>
  );
}
