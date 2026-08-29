import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Lot } from "../../../../../lib/api/types";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { LotForm } from "../lot-form";

export default async function NouveauLotPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const lotsRes = await apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } });

  return (
    <div className="animate-fade">
      <PageHeader
        title={ctx.dict.lots.creerTitre}
        back={<BackLink href={`/${locale}/lots`} label={ctx.dict.common.back} />}
      />
      <LotForm
        dict={ctx.dict}
        locale={ctx.locale}
        lotsParents={(lotsRes.ok ? lotsRes.data : []).map((l) => ({ id: l.id, numero: l.numero }))}
      />
    </div>
  );
}
