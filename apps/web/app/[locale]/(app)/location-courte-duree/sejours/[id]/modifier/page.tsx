import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAppContext } from "../../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../../lib/api/client";
import type { LcdSejour } from "../../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../../lib/i18n";
import { vueLcd } from "../../../../../../../lib/lcd";
import { PageHeader, BackLink } from "../../../../../../../components/page-header";
import { SejourForm } from "../../sejour-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").lcd.modifierSejour };
}

/** Modification d'un séjour — uniquement PREVU (l'API refuse sinon, 422). */
export default async function ModifierSejourPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const vue = vueLcd(ctx);
  if (vue !== "gestion" && vue !== "resident" && vue !== "gestionnaire") {
    redirect(`/${locale}/location-courte-duree/sejours/${id}`);
  }
  const { dict } = ctx;

  const sejourRes = await apiFetch<LcdSejour>(`/lcd/sejours/${id}`);
  if (!sejourRes.ok) notFound();
  if (sejourRes.data.statut !== "PREVU") redirect(`/${locale}/location-courte-duree/sejours/${id}`);

  return (
    <div className="animate-fade">
      <PageHeader
        title={dict.lcd.modifierSejour}
        subtitle={sejourRes.data.voyageurPrincipalNom}
        back={<BackLink href={`/${locale}/location-courte-duree/sejours/${id}`} label={dict.lcd.sejour} />}
      />
      <SejourForm dict={dict} locale={ctx.locale} lots={[]} sejour={sejourRes.data} />
    </div>
  );
}
