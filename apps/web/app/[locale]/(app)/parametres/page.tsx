import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { getDict, isLocale } from "../../../../lib/i18n";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { LogoForm } from "./logo-form";
import { PhotosForm } from "./photos-form";
import { apiFetch } from "../../../../lib/api/client";
import type { EspaceCommun } from "../../../../lib/api/types";
import { espaceImageCle } from "../../../../components/espaces/espace-image";
import {
  IdentiteForm,
  LegauxForm,
  OptionsForm,
  RecouvrementForm,
  ReglementForm,
} from "./parametres-forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.parametres };
}

export default async function ParametresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict, copropriete } = ctx;
  if (!copropriete) notFound();
  const pa = dict.parametres;
  const espacesRes = await apiFetch<EspaceCommun[]>("/espaces-communs");
  const espaces = (espacesRes.ok ? espacesRes.data : []).map((e) => ({ id: e.id, nom: e.nom, cleDefaut: espaceImageCle(e.nom, e.type) }));

  return (
    <div className="animate-fade">
      <PageHeader title={pa.titre} subtitle={copropriete.nom} />

      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <SectionHeader title={pa.logo} className="mb-5" />
          <LogoForm dict={dict} locale={ctx.locale} coproId={copropriete.id} logoActuel={copropriete.logoStoragePath ?? null} />
        </Card>

        <Card>
          <SectionHeader title={pa.photos} className="mb-5" />
          <PhotosForm dict={dict} locale={ctx.locale} coproId={copropriete.id} photos={copropriete.photosJson ?? {}} espaces={espaces} />
        </Card>

        <Card>
          <SectionHeader title={pa.identite} className="mb-5" />
          <IdentiteForm dict={dict} locale={ctx.locale} copro={copropriete} />
        </Card>

        <Card>
          <SectionHeader title={pa.reglement} className="mb-5" />
          <ReglementForm dict={dict} locale={ctx.locale} copro={copropriete} />
        </Card>

        <Card>
          <SectionHeader title={pa.options} className="mb-5" />
          <OptionsForm dict={dict} locale={ctx.locale} copro={copropriete} />
        </Card>

        <Card>
          <SectionHeader title={pa.recouvrement} className="mb-5" />
          <RecouvrementForm dict={dict} locale={ctx.locale} copro={copropriete} />
        </Card>

        {/* Section légale — visuellement distincte (brief J5) */}
        <Card id="legaux" className="border-ink/20">
          <SectionHeader title={`⚖ ${pa.legaux}`} className="mb-5" />
          <LegauxForm dict={dict} locale={ctx.locale} copro={copropriete} />
        </Card>
      </div>
    </div>
  );
}
