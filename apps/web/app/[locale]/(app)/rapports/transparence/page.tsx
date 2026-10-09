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
import { CAlert, CChart, CFile, CMoneyBag, CWallet, IconCircle } from "../../../../../components/ui/color-icons";
import { DocumentViewerButton, FileViewerButton } from "../../../../../components/documents/document-viewer";
import { ExerciceLinks } from "../onglets";
import { CategorieIcone } from "../categorie-icone";
import { Amount, Figure } from "../../../../../components/ui/amount";
import { LiveList } from "../../../../../components/ui/live-list";

/** Teintes de la barre empilée sur la salle verte : lime d'abord (logo), puis accents clairs. */
const TEINTES_AFFICHE = ["var(--color-lime)", "var(--color-sage)", "var(--color-tosca-mid)", "var(--color-sand-mid)", "var(--color-lilac-mid)", "var(--color-surface)"];

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
    <div className="page-root">
      <PageHeader title={r.transparenceTitre} subtitle={r.transparenceSubtitle} actions={<ExerciceLinks base="/rapports/transparence" exercice={exercice} locale={ctx.locale} />} />
      {!res.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : (() => {
        const t = res.data;
        const bvr = t.budget_vs_realise;
        const dpc = t.depenses_par_categorie;
        // Parts relatives pour la barre empilée (même lecture que l'anneau : valeurs déjà agrégées par l'API).
        const totalCat = dpc.categories.reduce((s, c) => s + Math.max(0, Number(c.montant)), 0);
        const parts = dpc.categories.filter((c) => Number(c.montant) > 0).map((c, i) => ({ ...c, ratio: totalCat > 0 ? Number(c.montant) / totalCat : 0, couleur: TEINTES_AFFICHE[i % TEINTES_AFFICHE.length]! }));
        return (
          <>
            {/* Moment « affiche » : où est allé l'argent de l'exercice, d'un coup d'œil. */}
            <section className="relative overflow-hidden rounded-[28px] bg-brand p-6 sm:p-9">
              <svg aria-hidden viewBox="0 0 120 120" className="pointer-events-none absolute -end-8 -top-10 size-56 text-white/[0.06] sm:size-72">
                <path d="M10 70 60 30l50 40v-16L60 14 10 54z" fill="currentColor" />
                <path d="M10 104 60 64l50 40V88L60 48 10 88z" fill="currentColor" />
              </svg>
              <p className="relative text-[15px] font-semibold text-white">{r.depenses} · <span className="tnum">{exercice}</span></p>
              <p className="tnum relative mt-2 text-[40px] font-bold leading-none tracking-[-0.02em] text-lime sm:text-[56px]"><Amount value={dpc.total} locale={ctx.locale} /></p>
              {bvr.budget && bvr.totaux.montant_prevu ? (
                <p className="relative mt-3 text-[14px] text-white/75">{r.prevu} <span className="tnum font-semibold text-white"><Amount value={bvr.totaux.montant_prevu} locale={ctx.locale} /></span>{bvr.totaux.pourcentage_realise ? <> · {r.realise} <span className="tnum font-semibold text-white"><Figure value={`${bvr.totaux.pourcentage_realise} %`} /></span></> : null}</p>
              ) : null}
              <div className="relative mt-7">
                <p className="mb-2.5 text-[13px] font-semibold text-white/70">{r.parCategorie}</p>
                <div className="flex h-4 w-full gap-[3px] overflow-hidden rounded-full bg-white/10" aria-hidden>
                  {parts.map((c) => <span key={c.categorie} className="pb-fill h-full first:rounded-s-full last:rounded-e-full" style={{ width: `${c.ratio * 100}%`, background: c.couleur }} />)}
                </div>
                {parts.length > 0 ? (
                  <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {parts.map((c) => (
                      <li key={c.categorie} className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: c.couleur }} aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-white/75">{dict.enumsDepenses.categorieDepense[c.categorie]}</p>
                          <p className="mt-0.5 flex items-baseline gap-2"><span className="tnum text-[17px] font-bold text-white"><Amount value={c.montant} locale={ctx.locale} /></span><span className="tnum rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-bold text-white"><Figure value={`${Math.round(c.ratio * 100)}%`} /></span></p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-4 text-[14px] text-white/75">{r.aucuneDepense}</p>}
              </div>
            </section>

            <Banner variant="info" className="mt-4 mb-6">{r.transparenceAide}</Banner>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<CWallet />} tone="sage" label={r.compteCourant} value={mad(t.tresorerie.compte_courant_estime)} hint={r.compteCourantCourt} />
              <StatCard icon={<CMoneyBag />} tone="lilac" label={r.reserve} value={t.tresorerie.reserve_configuree ? mad(t.tresorerie.reserve) : "—"} trend={t.tresorerie.reserve_configuree ? undefined : r.reserveAbsente} trendTone="neutral" />
              <StatCard icon={<CChart />} tone="tosca" label={r.recouvrement} value={t.recouvrement.exercice ? `${t.recouvrement.exercice} %` : "—"} hint={`${r.encaisse} ${mad(t.recouvrement.encaisse)}`} />
              <StatCard icon={<CAlert />} tone={Number(t.impayes.total) > 0 ? "warn" : "sage"} label={r.impayes} value={mad(t.impayes.total)} hint={fill(r.lotsEnRetard, { n: t.impayes.nb_lots_en_retard })} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <SectionHeader title={r.budget} subtitle={bvr.budget ? `${r.prevu} ${mad(bvr.totaux.montant_prevu)} · ${r.realise} ${mad(bvr.totaux.realise)}${bvr.totaux.pourcentage_realise ? ` · ${bvr.totaux.pourcentage_realise} %` : ""}` : r.aucunBudget} />
                {bvr.postes.length > 0 ? (
                  <ul className="mt-5 divide-y divide-wash-strong rounded-[18px] bg-surface px-4 sm:px-5">
                    {bvr.postes.map((po) => {
                      const ratio = po.montant_prevu && Number(po.montant_prevu) > 0 ? Number(po.realise) / Number(po.montant_prevu) : 0;
                      return (
                        <li key={po.poste_id} className="py-3.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <span className="min-w-0 text-[14px] font-semibold text-ink">{po.libelle}<span className="ms-2 text-[12px] font-normal text-soft">{dict.enumsDepenses.categorieDepense[po.categorie]}</span></span>
                            <span className="tnum text-[13px] text-soft"><b className="font-bold text-ink"><Amount value={po.realise} locale={ctx.locale} /></b> / <Amount value={po.montant_prevu} locale={ctx.locale} /></span>
                          </div>
                          <ProgressBar ratio={Math.min(1, ratio)} tone={po.depassement ? "danger" : ratio > 0.85 ? "warn" : "action"} className="mt-2" />
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Card>
              <Card className="lg:self-start">
                <SectionHeader title={r.rapportsSoumis} subtitle={r.rapportsSoumisAide} />
                {t.rapports_gestion.length === 0 ? <p className="mt-4 rounded-[16px] bg-surface px-4 py-3.5 text-[14px] text-soft">{r.aucunRapportSoumis}</p> : (
                  <LiveList as="ul" className="mt-4 space-y-2">
                    {t.rapports_gestion.map((rg) => (
                      <li key={rg.document_id} className="flex items-center gap-3 rounded-[16px] bg-surface p-3">
                        <IconCircle tone="sage" size={42}><CFile /></IconCircle>
                        <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-ink">{rg.nom}</p><p className="text-[12px] text-soft">{formatDate(rg.date, ctx.locale)}</p></div>
                        <DocumentViewerButton documentId={rg.document_id} nom={rg.nom} labels={viewer} />
                      </li>
                    ))}
                  </LiveList>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Link href={p("/documents")} className="link text-[14px]">{dict.nav.documents}</Link>
                  {t.impayes.nb_lots_en_retard > 0 ? <Badge variant="warn">{fill(r.lotsEnRetard, { n: t.impayes.nb_lots_en_retard })}</Badge> : null}
                </div>
              </Card>
            </div>

            <section className="mt-10">
              <SectionHeader title={r.depenses} subtitle={t.factures_visibles ? r.facturesVisibles : undefined} className="mb-3" />
              {t.depenses.length === 0 ? <EmptyState title={r.aucuneDepense} illustration="empty-appels" /> : (
                <LiveList as="ul" className="-mx-2 sm:-mx-3">
                  {t.depenses.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] px-2 py-3 transition-colors hover:bg-wash sm:flex-nowrap sm:px-3">
                      <CategorieIcone categorie={d.categorie} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold leading-snug text-ink">{d.libelle}</p>
                        <p className="mt-0.5 text-[13px] text-soft">{dict.enumsDepenses.categorieDepense[d.categorie]}{d.source === "FONDS_RESERVE" ? ` · ${r.reserve}` : ""}{d.prestataire ? ` · ${d.prestataire}` : ""} · <span className="tnum">{formatDate(d.date, ctx.locale)}</span></p>
                      </div>
                      <span className="tnum ms-auto shrink-0 text-[15px] font-bold text-ink"><Amount value={d.montant_ttc} locale={ctx.locale} /></span>
                      {t.factures_visibles && (d.factures ?? []).length > 0 ? (
                        <div className="flex w-full flex-wrap justify-end gap-1.5 sm:w-auto">{d.factures!.map((f) => <FileViewerButton key={f.id} src={f.url} nom={f.numero ?? d.libelle} labels={viewer} label={f.numero ?? r.voirFacture} />)}</div>
                      ) : null}
                    </li>
                  ))}
                </LiveList>
              )}
            </section>
          </>
        );
      })()}
    </div>
  );
}
