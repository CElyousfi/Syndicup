import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppContext } from "../../../../lib/app-context";
import { getDict, isLocale } from "../../../../lib/i18n";
import { DashboardSyndic } from "./syndic";
import { DashboardResident } from "./resident";
import { DashboardGardien } from "./gardien";
import { DashboardPrestataire } from "./prestataire";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.dashboard };
}

/** B1→B5 : LE tableau de bord est différent par rôle — résolu côté serveur. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);

  switch (ctx.role) {
    case "SUPER_ADMIN":
      // L'opérateur plateforme n'a pas de tableau de bord « résidence » : sa console.
      return redirect(`/${ctx.locale}/admin`);
    case "SYNDIC":
      return <DashboardSyndic ctx={ctx} lectureSeule={false} />;
    case "CONSEIL_SYNDICAL":
      return <DashboardSyndic ctx={ctx} lectureSeule />;
    case "PROPRIETAIRE":
    case "INDIVISAIRE":
    case "PERSONNE_MORALE_REPRESENTANT":
      return <DashboardResident ctx={ctx} locataire={false} />;
    case "LOCATAIRE":
      return <DashboardResident ctx={ctx} locataire />;
    case "GESTIONNAIRE_LCD":
      // Gestionnaire de location courte durée : vue résident sans finances ni AG (M15).
      return <DashboardResident ctx={ctx} locataire />;
    case "GARDIEN":
      return <DashboardGardien ctx={ctx} />;
    case "PRESTATAIRE":
      return <DashboardPrestataire ctx={ctx} />;
  }
}
