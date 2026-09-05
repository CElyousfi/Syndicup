import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { LcdDeclaration } from "../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { vueLcd } from "../../../../../../lib/lcd";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { ButtonLink } from "../../../../../../components/ui/button";
import { CKey, IconCircle } from "../../../../../../components/ui/color-icons";
import { SejourForm } from "../sejour-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").lcd.declarerSejour };
}

/** Nouveau séjour — lots limités aux déclarations VALIDEES visibles par l'appelant (RLS). */
export default async function NouveauSejourPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lot?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const vue = vueLcd(ctx);
  if (vue !== "gestion" && vue !== "resident" && vue !== "gestionnaire") {
    redirect(`/${locale}/location-courte-duree`);
  }
  const { dict } = ctx;
  const l = dict.lcd;

  const declRes = await apiFetch<LcdDeclaration[]>("/lcd/declarations", {
    searchParams: { statut: "VALIDEE" },
  });
  const lots = (declRes.ok ? declRes.data : [])
    .filter((d) => d.lot)
    .map((d) => ({ id: d.lotId, numero: d.lot.numero }))
    .sort((a, b) => a.numero.localeCompare(b.numero));

  return (
    <div className="animate-fade">
      <PageHeader
        title={l.declarerSejour}
        subtitle={l.aucunSejourAide}
        back={<BackLink href={`/${locale}/location-courte-duree`} label={dict.nav.locationCourteDuree} />}
      />
      {lots.length === 0 ? (
        <EmptyState
          title={l.aucunLotValide}
          icon={
            <IconCircle tone="sand" size={64}>
              <CKey width={30} height={30} />
            </IconCircle>
          }
          action={
            <ButtonLink href={`/${locale}/location-courte-duree`} variant="secondary" size="sm">
              {dict.common.back}
            </ButtonLink>
          }
        />
      ) : (
        <SejourForm dict={dict} locale={ctx.locale} lots={lots} lotInitial={sp.lot} />
      )}
    </div>
  );
}
