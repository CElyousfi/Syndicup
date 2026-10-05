import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { SectionHeader } from "../../../../../components/ui/card";
import { CCoins, IconCircle } from "../../../../../components/ui/color-icons";
import { IconChevronEnd } from "../../../../../components/ui/icons";
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
    <div className="page-root">
      <PageHeader title={j.especesTitre} subtitle={j.especesSubtitle} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><DeclarerForm dict={dict} locale={ctx.locale} lots={lots} lignes={lignes} comptes={[]} mode="especes" auNom /></div>
        {/* Historique à plat (Wise) : pastille, lot en gras, date, montant + statut, chevron. */}
        <section className="min-w-0">
          <SectionHeader title={j.mesSaisies} className="mb-2" />
          {mes.rows.length === 0 ? <p className="mt-3 text-sm text-soft">{j.aucuneDeclaration}</p> : (
            <ul className="-mx-2">
              {mes.rows.filter((x) => x.methode === "ESPECES").map((x) => (
                <li key={x.id}>
                  <Link href={`/${locale}/finances/justificatifs/${x.id}`} className="group flex items-center gap-3 rounded-[18px] px-2 py-3 transition-colors hover:bg-wash">
                    <IconCircle tone={x.statut === "REJETE" ? "danger" : x.statut === "VALIDE" ? "ok" : "sand"} size={44}><CCoins width={22} height={22} /></IconCircle>
                    <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-bold text-ink">{x.lot?.numero}</p><p className="tnum text-[13px] text-soft">{formatDate(x.datePaiementDeclaree, ctx.locale)}</p></div>
                    <div className="flex shrink-0 flex-col items-end gap-1"><span className="tnum text-[15px] font-bold text-ink">{formatMAD(x.montant, ctx.locale)}</span><Badge variant={justificatifVariant[x.statut]}>{e.statutJustificatif[x.statut]}</Badge></div>
                    <IconChevronEnd width={18} height={18} className="shrink-0 text-link" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
