import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { justificatifVariant } from "../../../../../lib/status";
import { DeclarerForm } from "../justificatifs/declarer-form";
import { justificatifs, lotsEtLignesOuvertes } from "../justificatifs/data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.especes };
}

/** Gardien (et syndic) : remise d'espèces à la loge + historique de ses saisies. */
export default async function EspecesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["GARDIEN", "SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const j = dict.justificatifs;
  const e = dict.enumsJustificatifs;
  const [{ lots, lignes }, mes] = await Promise.all([lotsEtLignesOuvertes(), justificatifs()]);
  return (
    <div className="animate-fade">
      <PageHeader title={j.especesTitre} subtitle={j.especesSubtitle} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><DeclarerForm dict={dict} locale={ctx.locale} lots={lots} lignes={lignes} comptes={[]} mode="especes" auNom /></div>
        <Card>
          <SectionHeader title={j.mesSaisies} />
          {mes.rows.length === 0 ? <p className="mt-3 text-sm text-soft">{j.aucuneDeclaration}</p> : (
            <ul className="mt-3 divide-y divide-hairline">
              {mes.rows.filter((x) => x.methode === "ESPECES").map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><Link href={`/${locale}/finances/justificatifs/${x.id}`} className="block truncate text-sm font-medium text-ink hover:text-action">{x.lot?.numero}</Link><span className="tnum text-[12px] text-faint">{formatDate(x.datePaiementDeclaree, ctx.locale)}</span></div>
                  <div className="flex flex-col items-end gap-1"><span className="tnum text-sm font-medium text-ink">{formatMAD(x.montant, ctx.locale)}</span><Badge variant={justificatifVariant[x.statut]}>{e.statutJustificatif[x.statut]}</Badge></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
