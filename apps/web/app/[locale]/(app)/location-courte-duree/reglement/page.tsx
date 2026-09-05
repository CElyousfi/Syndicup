import type { Metadata } from "next";
import { exigerRole, getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { AssembleeGenerale, LcdReglement } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Banner } from "../../../../../components/ui/banner";
import { ReglementForm } from "./reglement-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").lcd.reglementTitre };
}

/** Régime LCD de la copropriété — syndic seul (décision d'AG, Doc A §10.2). */
export default async function ReglementLcdPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const l = dict.lcd;

  const [reglementRes, agsRes] = await Promise.all([
    apiFetch<LcdReglement>("/lcd/reglement"),
    apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { limit: 20 } }),
  ]);
  const reglement = reglementRes.ok ? reglementRes.data : null;

  // Résolutions ADOPTÉES des AG clôturées — l'API ne les expose que sur le détail d'une AG.
  const agsCloturees = (agsRes.ok ? agsRes.data : []).filter((a) => a.statut === "CLOTUREE").slice(0, 10);
  const details = await Promise.all(
    agsCloturees.map((a) => apiFetch<AssembleeGenerale>(`/ag/${a.id}`))
  );
  const resolutions = details.flatMap((r, idx) =>
    r.ok
      ? (r.data.resolutions ?? [])
          .filter((res) => res.resultat === "ADOPTEE")
          .map((res) => ({
            id: res.id,
            label: `${formatDate(agsCloturees[idx]!.dateAg, ctx.locale)} · ${res.ordre}. ${res.texte}`,
          }))
      : []
  );

  return (
    <div className="animate-fade">
      <PageHeader
        title={l.reglementTitre}
        subtitle={l.reglementSubtitle}
        back={<BackLink href={`/${locale}/location-courte-duree`} label={dict.nav.locationCourteDuree} />}
      />

      {reglement ? (
        <>
          {reglement.regimeLcd === "NON_DEFINI" ? (
            <Banner variant="legal" title={l.regimeNonDefini} className="mb-5">
              {l.regimeNonDefiniSyndic}
            </Banner>
          ) : null}
          <ReglementForm dict={dict} locale={ctx.locale} reglement={reglement} resolutions={resolutions} />
        </>
      ) : (
        <Banner variant="warn">{l.chargementImpossible}</Banner>
      )}
    </div>
  );
}
