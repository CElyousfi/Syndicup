/** Impayés échus (M18, syndic / conseil) — ancienneté, filtres par tranche, export csv / xlsx journalisé. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { LigneImpayee, SyntheseImpayes } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD, formatPeriode } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { ExportButtons } from "../../../../../components/ui/export-buttons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { escaladeVariant, ligneAppelVariant, trancheVariant } from "../../../../../lib/status";
import { RapportsTabs } from "../onglets";

const TRANCHES = ["TOUTES", "0_30", "31_90", "91_180", "PLUS_180"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.impayesTitre };
}

export default async function ImpayesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tranche?: string; sort?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const r = dict.rapports;
  const tranche = (TRANCHES as readonly string[]).includes(sp.tranche ?? "") && sp.tranche !== "TOUTES" ? sp.tranche : undefined;
  const res = await apiFetch<LigneImpayee[]>("/rapports/impayes", { searchParams: { tranche, limit: 100, sort: sp.sort } });
  const synthese = res.ok ? ((res.meta as { synthese?: SyntheseImpayes }).synthese ?? null) : null;
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  return (
    <div className="animate-fade">
      <PageHeader title={r.impayesTitre} subtitle={r.impayesSubtitle} actions={<ExportButtons ressource="impayes" filtres={{ tranche }} labels={{ csv: r.exporterCsv, xlsx: r.exporterXlsx, title: r.exportImpayesAide }} />} />
      <RapportsTabs dict={dict} locale={ctx.locale} active="impayes" />
      {synthese ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink">{mad(synthese.total)}</span>
          <span className="text-soft">· {fill(r.lotsEnRetard, { n: synthese.nb_lots_en_retard })} · {fill(r.nbLignes, { n: synthese.nb_lignes })}</span>
        </div>
      ) : null}
      <LinkTabs className="mb-4" tabs={TRANCHES.map((t) => ({ href: p(`/rapports/impayes${t === "TOUTES" ? "" : `?tranche=${t}`}`), label: t === "TOUTES" ? r.toutes : dict.enumsRapports.tranche[t], active: t === "TOUTES" ? !tranche : tranche === t, count: t === "TOUTES" ? undefined : synthese?.tranches.find((x) => x.tranche === t)?.nb_lignes }))} />
      {!res.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : res.data.length === 0 ? <EmptyState title={r.aucunImpaye} hint={r.aucunImpayeAide} /> : (
        <TableCard>
          <Table>
            <THead><TH>{r.lot}</TH><TH>{r.periode}</TH><TH>{r.echeance}</TH><TH align="center">{r.retardJours}</TH><TH>{r.tranche}</TH><TH align="end">{r.du}</TH><TH align="end">{r.paye}</TH><TH align="end">{r.resteDu}</TH><TH>{r.escalade}</TH></THead>
            <tbody>
              {res.data.map((l) => (
                <TR key={l.appel_de_fonds_lot_id}>
                  <TD className="font-semibold text-ink"><Link href={p(`/lots/${l.lot_id}?onglet=finances`)} className="hover:text-action">{l.lot_numero}</Link>{l.conteste ? <Badge variant="warn" className="ms-2">{r.conteste}</Badge> : null}</TD>
                  <TD className="text-body">{formatPeriode(l.periode, ctx.locale)}<span className="block text-[11px] text-faint">{dict.enums.typeAppel[l.type]}</span></TD>
                  <TD className="tnum text-soft">{formatDate(l.date_echeance, ctx.locale)}</TD>
                  <TD align="center" className="tnum text-body">{l.retard_jours}</TD>
                  <TD><Badge variant={trancheVariant[l.tranche]}>{dict.enumsRapports.tranche[l.tranche]}</Badge></TD>
                  <TD align="end" className="tnum text-body">{mad(l.montant_du)}</TD>
                  <TD align="end" className="tnum text-body">{mad(l.montant_paye)}</TD>
                  <TD align="end" className="tnum font-semibold text-danger">{mad(l.reste_du)}</TD>
                  <TD><Badge variant={ligneAppelVariant[l.statut]}>{dict.enums.statutLigne[l.statut]}</Badge> <Badge variant={escaladeVariant(l.niveau_escalade)}>{l.niveau_escalade}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
