/** Nouvel import (M24) — étape 1 : type + fichier (+ options), analysé immédiatement. */
import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import type { TypeImport } from "../../../../../lib/api/types";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { ImportForm } from "../import-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").importation.nouvelImport };
}
export default async function NouvelImportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const t = dict.importation;
  const types: TypeImport[] = ["LOTS_PROPRIETAIRES", "SOLDES_OUVERTURE", "PRESTATAIRES", "CONTRATS", "VEHICULES_BADGES", "PERSONNEL"];
  return (
    <div className="animate-fade">
      <PageHeader back={<BackLink href={`/${locale}/import`} label={t.titre} />} title={t.nouvelImport} subtitle={`${t.etapes.fichier} → ${t.etapes.mapping} → ${t.etapes.apercu} → ${t.etapes.execution}`} />
      <div className="max-w-3xl"><ImportForm dict={dict} locale={ctx.locale} typeInitial={types.includes(sp.type as TypeImport) ? (sp.type as TypeImport) : undefined} /></div>
    </div>
  );
}
