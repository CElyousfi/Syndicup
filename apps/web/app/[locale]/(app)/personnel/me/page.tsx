/** « Mon dossier » (M20) — redirige le gardien / employé vers sa propre fiche RH. */
import { redirect } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { PersonnelRh } from "../../../../../lib/api/types";
import { Banner } from "../../../../../components/ui/banner";

export default async function MonDossierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const res = await apiFetch<PersonnelRh[]>("/personnel");
  const mienne = res.ok ? res.data.find((f) => f.utilisateurId === ctx.profil.id) : undefined;
  if (mienne) redirect(`/${ctx.locale}/personnel/${mienne.id}`);
  return <Banner variant="info">{ctx.dict.personnel.aucuneFiche}</Banner>;
}
