import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { Lot, SoldeLot } from "../../../../../../lib/api/types";
import { fill } from "../../../../../../lib/i18n";
import { versCentimes } from "../../../../../../lib/centimes";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { TransfertWizard } from "./transfert-wizard";

export default async function TransfertPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);

  const [lotRes, soldeRes] = await Promise.all([
    apiFetch<Lot>(`/lots/${id}`),
    apiFetch<SoldeLot>(`/finances/lots/${id}/solde`),
  ]);
  if (!lotRes.ok) notFound();
  const soldeDu = soldeRes.ok ? soldeRes.data.solde_du : "0.00";

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={`/${locale}/lots/${id}`} label={ctx.dict.common.back} />}
        title={fill(ctx.dict.lots.transfertTitre, { numero: lotRes.data.numero })}
      />
      <TransfertWizard
        dict={ctx.dict}
        locale={ctx.locale}
        lotId={id}
        lotNumero={lotRes.data.numero}
        soldeDu={soldeDu}
        aDette={versCentimes(soldeDu) > 0n}
      />
    </div>
  );
}
