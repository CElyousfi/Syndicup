import { redirect } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Lot } from "../../../../../lib/api/types";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { IncidentForm } from "./incident-form";

export default async function NouvelIncidentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  if (ctx.role === "PRESTATAIRE") redirect(`/${locale}/tableau-de-bord`);

  const lotsRes = await apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } });

  return (
    <div className="animate-fade">
      <PageHeader
        title={ctx.dict.incidents.signaler}
        back={<BackLink href={`/${locale}/incidents`} label={ctx.dict.nav.incidents} />}
      />
      <IncidentForm
        dict={ctx.dict}
        locale={ctx.locale}
        lots={(lotsRes.ok ? lotsRes.data : []).map((l) => ({ id: l.id, numero: l.numero }))}
      />
    </div>
  );
}
