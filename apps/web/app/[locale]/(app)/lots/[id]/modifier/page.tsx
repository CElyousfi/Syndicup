import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { Lot } from "../../../../../../lib/api/types";
import { fill } from "../../../../../../lib/i18n";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { LotForm } from "../../lot-form";

export default async function ModifierLotPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);

  const [lotRes, lotsRes] = await Promise.all([
    apiFetch<Lot>(`/lots/${id}`),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  if (!lotRes.ok) notFound();

  return (
    <div className="animate-fade">
      <PageHeader
        title={fill(ctx.dict.lots.modifierTitre, { numero: lotRes.data.numero })}
        back={<BackLink href={`/${locale}/lots/${id}`} label={ctx.dict.common.back} />}
      />
      <LotForm
        dict={ctx.dict}
        locale={ctx.locale}
        lot={lotRes.data}
        lotsParents={(lotsRes.ok ? lotsRes.data : []).map((l) => ({ id: l.id, numero: l.numero }))}
      />
    </div>
  );
}
