/**
 * « Où va mon argent » (M18, Doc A §3.5) — tout membre, locataires compris. Agrégats de niveau
 * copropriété uniquement (jamais un lot) ; factures ouvertes dans la visionneuse si le syndic l'a
 * autorisé ; rapports de gestion soumis à l'AG. Le syndic voit la même page (aperçu résident).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { Transparence } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Banner } from "../../../../../components/ui/banner";
import { Badge } from "../../../../../components/ui/badge";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { StatCard } from "../../../../../components/ui/stat-card";
import { ProgressBar } from "../../../../../components/ui/progress";
import { Donut } from "../../../../../components/ui/charts";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { CAlert, CChart, CMoneyBag, CWallet } from "../../../../../components/ui/color-icons";
import { DocumentViewerButton, FileViewerButton } from "../../../../../components/documents/document-viewer";
import { ExerciceLinks } from "../onglets";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.transparenceTitre };
}

export default async function TransparencePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ exercice?: string; page?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const r = dict.rapports;
  const exercice = /^\d{4}$/.test(sp.exercice ?? "") ? sp.exercice! : String(new Date().getFullYear());
  const res = await apiFetch<Transparence>("/rapports/transparence", { searchParams: { exercice, limit: 50, page: sp.page } });
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  return (
    <div className="animate-fade">
      <PageHeader title={r.transparenceTitre} subtitle={r.transparenceSubtitle} actions={<ExerciceLinks base="/rapports/transparence" exercice={exercice} locale={ctx.locale} />} />
      {!res.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : (() => {
        const t = res.data;
        const bvr = t.budget_vs_realise;
        return (
          <>
            <Banner variant="info" className="mb-4">{r.transparenceAide}</Banner>
            <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<CWallet />} tone="sage" label={r.compteCourant} value={mad(t.tresorerie.compte_courant_estime)} hint={r.compteCourantCourt} />
              <StatCard icon={<CMoneyBag />} tone="lilac" label={r.reserve} value={t.tresorerie.reserve_configuree ? mad(t.tresorerie.reserve) : "—"} trend={t.tresorerie.reserve_configuree ? undefined : r.reserveAbsente} trendTone="neutral" />
              <StatCard icon={<CChart />} tone="tosca" label={r.recouvrement} value={t.recouvrement.exercice ? `${t.recouvrement.exercice} %` : "—"} hint={`${r.encaisse} ${mad(t.recouvrement.encaisse)}`} />
              <StatCard icon={<CAlert />} tone={Number(t.impayes.total) > 0 ? "warn" : "sage"} label={r.impayes} value={mad(t.impayes.total)} hint={fill(r.lotsEnRetard, { n: t.impayes.nb_lots_en_retard })} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <SectionHeader title={r.budget} subtitle={bvr.budget ? `${r.prevu} ${mad(bvr.totaux.montant_prevu)} · ${r.realise} ${mad(bvr.totaux.realise)}${bvr.totaux.pourcentage_realise ? ` · ${bvr.totaux.pourcentage_realise} %` : ""}` : r.aucunBudget} />
                {bvr.postes.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {bvr.postes.map((po) => {
                      const ratio = po.montant_prevu && Number(po.montant_prevu) > 0 ? Number(po.realise) / Number(po.montant_prevu) : 0;
                      return (
                        <li key={po.poste_id}>
                          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-ink">{po.libelle}<span className="ms-2 text-[12px] text-faint">{dict.enumsDepenses.categorieDepense[po.categorie]}</span></span><span className="tnum text-body">{mad(po.realise)} / {mad(po.montant_prevu)}</span></div>
                          <ProgressBar ratio={Math.min(1, ratio)} tone={po.depassement ? "danger" : ratio > 0.85 ? "warn" : "ok"} className="mt-1.5" />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Card>
              <Card>
                <SectionHeader title={r.parCategorie} subtitle={`${r.depenses} · ${exercice}`} />
                <div className="mt-5"><Donut size={150} centerLabel={mad(t.depenses_par_categorie.total)} centerSub={String(t.depenses_par_categorie.nb)} items={t.depenses_par_categorie.categories.map((c) => ({ label: dict.enumsDepenses.categorieDepense[c.categorie], value: Number(c.montant), display: mad(c.montant) }))} /></div>
              </Card>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SectionHeader title={r.depenses} subtitle={t.factures_visibles ? r.facturesVisibles : undefined} className="mb-3" />
                {t.depenses.length === 0 ? <EmptyState title={r.aucuneDepense} /> : (
                  <TableCard>
                    <Table>
                      <THead><TH>{r.date}</TH><TH>{r.libelle}</TH><TH>{r.prestataire}</TH><TH align="end">{r.montant}</TH>{t.factures_visibles ? <TH>{dict.depenses.factures}</TH> : null}</THead>
                      <tbody>
                        {t.depenses.map((d) => (
                          <TR key={d.id}>
                            <TD className="tnum text-soft">{formatDate(d.date, ctx.locale)}</TD>
                            <TD className="font-medium text-ink">{d.libelle}<span className="block text-[12px] text-faint">{dict.enumsDepenses.categorieDepense[d.categorie]}{d.source === "FONDS_RESERVE" ? ` · ${r.reserve}` : ""}</span></TD>
                            <TD className="text-body">{d.prestataire ?? "—"}</TD>
                            <TD align="end" className="tnum text-ink">{mad(d.montant_ttc)}</TD>
                            {t.factures_visibles ? <TD>{(d.factures ?? []).length === 0 ? <span className="text-faint">—</span> : <div className="flex flex-wrap gap-1.5">{d.factures!.map((f) => <FileViewerButton key={f.id} src={f.url} nom={f.numero ?? d.libelle} labels={viewer} label={f.numero ?? r.voirFacture} />)}</div>}</TD> : null}
                          </TR>
                        ))}
                      </tbody>
                    </Table>
                  </TableCard>
                )}
              </div>
              <Card>
                <SectionHeader title={r.rapportsSoumis} subtitle={r.rapportsSoumisAide} />
                {t.rapports_gestion.length === 0 ? <p className="mt-3 text-sm text-soft">{r.aucunRapportSoumis}</p> : (
                  <ul className="mt-3 divide-y divide-hairline">
                    {t.rapports_gestion.map((rg) => (
                      <li key={rg.document_id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{rg.nom}</p><p className="text-[12px] text-faint">{formatDate(rg.date, ctx.locale)}</p></div>
                        <DocumentViewerButton documentId={rg.document_id} nom={rg.nom} labels={viewer} />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-[12px] text-faint"><Link href={p("/documents")} className="text-action hover:underline">{dict.nav.documents}</Link></p>
                {t.impayes.nb_lots_en_retard > 0 ? <div className="mt-3"><Badge variant="warn">{fill(r.lotsEnRetard, { n: t.impayes.nb_lots_en_retard })}</Badge></div> : null}
              </Card>
            </div>
          </>
        );
      })()}
    </div>
  );
}
