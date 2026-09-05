import { redirect } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { LcdSejour, Lot } from "../../../../../lib/api/types";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { IncidentForm } from "./incident-form";

export default async function NouvelIncidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sejour?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  if (ctx.role === "PRESTATAIRE") redirect(`/${locale}/tableau-de-bord`);

  // M15 — séjours en cours visibles par l'appelant (RLS) : lien facultatif nuisance ↔ séjour.
  const [lotsRes, sejoursRes] = await Promise.all([
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
    apiFetch<LcdSejour[]>("/lcd/sejours", { searchParams: { statut: "EN_COURS" } }),
  ]);
  const sejours = (sejoursRes.ok ? sejoursRes.data : []).map((s) => ({
    id: s.id,
    lotId: s.lotId,
    libelle: `${ctx.dict.lcd.lot} ${s.lot?.numero ?? "—"} · ${s.voyageurPrincipalNom}`,
  }));

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
        sejours={sejours}
        sejourInitial={sp.sejour}
      />
    </div>
  );
}
