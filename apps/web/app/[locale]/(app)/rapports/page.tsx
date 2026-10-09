/**
 * Tableau de bord de gestion (M18, syndic / conseil) — trésorerie 12 mois, recouvrement, impayés
 * par ancienneté + top lots, dépenses par catégorie, budget vs réalisé, incidents, justificatifs.
 * Tout est calculé par l'API (GET /rapports/tableau-de-bord) : la page ne fait que présenter.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { TableauDeBord } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDateHeure, formatMAD, formatPeriode } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Banner } from "../../../../components/ui/banner";
import { Badge } from "../../../../components/ui/badge";
import { StatCard } from "../../../../components/ui/stat-card";
import { Bars, Donut } from "../../../../components/ui/charts";
import { TresorerieChart, AgeingBars } from "../../../../components/ui/charts-rapports";
import { Table, TD, TH, THead, TR } from "../../../../components/ui/table";
import { CAlert, CChart, CMoneyBag, CWallet } from "../../../../components/ui/color-icons";
import { IconChevronEnd } from "../../../../components/ui/icons";
import { trancheVariant, urgenceVariant } from "../../../../lib/status";
import { RapportsTabs, ExerciceLinks } from "./onglets";
import { Amount, Figure } from "../../../../components/ui/amount";
import { LiveList } from "../../../../components/ui/live-list";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.titre };
}

export default async function RapportsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ exercice?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "SYNDIC_COMPTABLE"]);
  const { dict } = ctx;
  const r = dict.rapports;
  const exercice = /^\d{4}$/.test(sp.exercice ?? "") ? sp.exercice! : String(new Date().getFullYear());
  const res = await apiFetch<TableauDeBord>("/rapports/tableau-de-bord", { searchParams: { exercice } });
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  const num = (v: string) => Number(v);
  const rtl = ctx.locale === "ar";

  return (
    <div className="page-root">
      <PageHeader title={r.titre} subtitle={r.subtitle} actions={<ExerciceLinks base="/rapports" exercice={exercice} locale={ctx.locale} />} />
      <RapportsTabs dict={dict} locale={ctx.locale} active="tableau" exercice={exercice} />
      {!res.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : (() => {
        const t = res.data;
        const bvr = t.budget_vs_realise;
        const maxPoste = Math.max(1, ...bvr.postes.map((x) => Math.max(num(x.montant_prevu ?? "0"), num(x.consomme))));
        return (
          <>
            {bvr.seuil_non_configure ? <Banner variant="legal" className="mb-5" title={r.seuilNonConfigure} action={<Link href={p("/parametres")} className="link">{dict.nav.parametres}</Link>}>{dict.depenses.seuilNonConfigureCorps}</Banner> : null}
            <div className="stagger-grid mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={<CWallet />} tone={num(t.tresorerie.compte_courant_estime) >= 0 ? "sage" : "danger"} label={r.compteCourant} value={mad(t.tresorerie.compte_courant_estime)} hint={r.compteCourantCourt} />
              <StatCard icon={<CMoneyBag />} tone="lilac" label={r.reserve} value={t.tresorerie.reserve_configuree ? mad(t.tresorerie.reserve) : "—"} trend={t.tresorerie.reserve_configuree ? undefined : r.reserveAbsente} trendTone="neutral" hint={`${r.entrees} ${mad(t.tresorerie.total_entrees)}`} />
              <StatCard icon={<CChart />} tone="tosca" label={r.recouvrement} value={t.recouvrement.exercice.taux ? `${t.recouvrement.exercice.taux} %` : "—"} hint={`${r.encaisse} ${mad(t.recouvrement.exercice.encaisse)}`} trend={t.recouvrement.periode.taux ? `${r.recouvrementMois} ${t.recouvrement.periode.taux} %` : undefined} trendTone="neutral" />
              <StatCard icon={<CAlert />} tone={num(t.impayes.total) > 0 ? "warn" : "sage"} label={r.impayes} value={mad(t.impayes.total)} hint={fill(r.lotsEnRetard, { n: t.impayes.nb_lots_en_retard })} href={p(`/rapports/impayes?exercice=${exercice}`)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <SectionHeader title={r.douzeMois} subtitle={r.douzeMoisAide} />
                <div className="mt-6">
                  <TresorerieChart height={330} rtl={rtl} legend={{ entrees: r.entrees, sorties: r.sorties, solde: r.solde }} points={t.tresorerie.serie_12_mois.map((m) => ({ label: formatPeriode(m.mois, ctx.locale), entrees: num(m.entrees), sorties: num(m.sorties), solde: num(m.solde), displayEntrees: mad(m.entrees), displaySorties: mad(m.sorties), displaySolde: mad(m.solde) }))} />
                </div>
              </Card>
              <Card>
                <SectionHeader title={r.impayes} subtitle={r.impayesAide} action={<Link href={p(`/rapports/impayes?exercice=${exercice}`)} className="link text-[14px]">{r.voirTout}</Link>} />
                <div className="mt-5">
                  <AgeingBars items={t.impayes.tranches.map((tr) => ({ label: dict.enumsRapports.tranche[tr.tranche], value: num(tr.montant), display: <Amount value={tr.montant} locale={ctx.locale} upIsGood={false} />, hint: `${tr.nb_lots} ${r.lots.toLowerCase()}`, tone: tr.tranche === "0_30" ? "info" : tr.tranche === "31_90" ? "warn" : "danger" }))} />
                </div>
                <h3 className="mt-7 text-[15px] font-bold text-ink">{r.topLots}</h3>
                {t.impayes.top_lots.length === 0 ? <p className="mt-2 text-sm text-soft">{r.aucunImpaye}</p> : (
                  <LiveList as="ul" className="-mx-2 mt-2 space-y-0.5">
                    {t.impayes.top_lots.map((l) => (
                      <li key={l.lot_id}>
                        <Link href={p(`/lots/${l.lot_id}?onglet=finances`)} className="group flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-wash">
                          <span className="tnum flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-bold text-ink" dir="ltr">{l.lot_numero}</span>
                          <span className="min-w-0 flex-1 text-[12.5px] text-soft">{l.retard_max_jours} j{l.conteste ? ` · ${r.conteste}` : ""}</span>
                          <span className="tnum text-[14px] font-bold text-danger"><Amount value={l.reste_du} locale={ctx.locale} upIsGood={false} /></span>
                          <IconChevronEnd width={16} height={16} className="shrink-0 text-link" />
                        </Link>
                      </li>
                    ))}
                  </LiveList>
                )}
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <SectionHeader title={r.budget} subtitle={bvr.budget ? `${r.exercice} ${bvr.exercice} · ${r.prevu} ${mad(bvr.totaux.montant_prevu)} · ${r.realise} ${mad(bvr.totaux.realise)}` : r.aucunBudget} action={bvr.budget ? <Link href={p(`/finances/budgets/${bvr.budget.id}`)} className="link text-[14px]">{dict.nav.budgets}</Link> : undefined} />
                {bvr.postes.length > 0 ? (
                  <Bars className="mt-8" height={190} items={bvr.postes.map((x) => ({ label: x.libelle, totalRatio: num(x.montant_prevu ?? "0") / maxPoste, paidRatio: num(x.montant_prevu ?? "0") > 0 ? Math.min(1, num(x.realise) / num(x.montant_prevu!)) : 0, displayTotal: mad(x.montant_prevu), displayPaid: mad(x.realise) }))} yTop={mad(String(maxPoste))} legendPaid={r.realise} legendTotal={r.prevu} />
                ) : null}
                {bvr.postes.length > 0 ? (
                  <div className="mt-6 overflow-x-auto scroll-thin">
                    <Table>
                      <THead><TH>{dict.depenses.poste}</TH><TH align="end">{r.prevu}</TH><TH align="end">{r.realise}</TH><TH align="end">{r.ecart}</TH><TH align="end">%</TH></THead>
                      <LiveList as="tbody">
                        {bvr.postes.map((x) => (
                          <TR key={x.poste_id}>
                            <TD className="font-medium text-ink">{x.libelle}<span className="block text-[12px] text-faint">{dict.enumsDepenses.categorieDepense[x.categorie]}</span></TD>
                            <TD align="end" className="tnum whitespace-nowrap text-body"><Amount value={x.montant_prevu} locale={ctx.locale} /></TD>
                            <TD align="end" className="tnum whitespace-nowrap text-ink"><Amount value={x.realise} locale={ctx.locale} /></TD>
                            <TD align="end" className={`tnum whitespace-nowrap ${x.depassement ? "text-danger" : "text-ok"}`}><Amount value={x.ecart} locale={ctx.locale} /></TD>
                            <TD align="end" className="tnum whitespace-nowrap text-body"><Figure value={x.pourcentage_realise ? `${x.pourcentage_realise} %` : "—"} /></TD>
                          </TR>
                        ))}
                        {bvr.hors_poste.map((h) => (
                          <TR key={h.categorie}><TD className="text-body">{dict.depenses.horsPoste} — {dict.enumsDepenses.categorieDepense[h.categorie]}</TD><TD align="end">—</TD><TD align="end" className="tnum whitespace-nowrap text-ink"><Amount value={h.realise} locale={ctx.locale} /></TD><TD align="end">—</TD><TD align="end">—</TD></TR>
                        ))}
                      </LiveList>
                    </Table>
                  </div>
                ) : null}
              </Card>
              <div className="min-w-0 space-y-4">
                <Card>
                  <SectionHeader title={r.depenses} subtitle={`${r.parCategorie} · ${r.exercice} ${exercice}`} />
                  <div className="mt-5">
                    <Donut size={150} centerLabel={<Amount value={t.depenses.exercice.total} locale={ctx.locale} />} centerSub={`${t.depenses.exercice.nb}`} items={t.depenses.exercice.categories.map((c) => ({ label: dict.enumsDepenses.categorieDepense[c.categorie], value: num(c.montant), display: <Amount value={c.montant} locale={ctx.locale} /> }))} />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 rounded-[16px] bg-surface px-4 py-3 text-[13px]">
                    <span className="text-soft">{r.depensesMois}</span>
                    <b className="tnum text-[15px] text-ink"><Amount value={t.depenses.mois.total} locale={ctx.locale} /></b>
                  </div>
                </Card>
                <Card>
                  <SectionHeader title={r.incidentsOuverts} action={<Link href={p("/incidents")} className="link text-[14px]">{r.voirTout}</Link>} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(Object.keys(t.incidents_ouverts.par_urgence) as (keyof typeof t.incidents_ouverts.par_urgence)[]).map((u) => (
                      <Badge key={u} variant={urgenceVariant[u]}>{dict.enums.urgence[u]} · {t.incidents_ouverts.par_urgence[u]}</Badge>
                    ))}
                  </div>
                  <div className="mt-5 divide-y divide-wash-strong rounded-[16px] bg-surface px-4 text-sm">
                    <Kv label={r.justificatifsAttente}><Link href={p("/finances/justificatifs")} className="tnum font-semibold text-ink hover:text-link">{t.justificatifs_en_attente.nb} · <Amount value={t.justificatifs_en_attente.montant} locale={ctx.locale} /></Link></Kv>
                    <Kv label={dict.contrats.actifs}><Link href={p("/contrats")} className="tnum font-semibold text-ink hover:text-link">{t.contrats.actifs}</Link></Kv>
                    <Kv label={dict.contrats.aRenouveler}><Link href={p("/contrats?statut=A_RENOUVELER")} className={`tnum font-semibold ${t.contrats.a_echoir_30j + t.contrats.echus_90j > 0 ? "text-warn" : "text-ink"} hover:text-link`}>{t.contrats.a_echoir_30j + t.contrats.echus_90j}</Link></Kv>
                    <Kv label={dict.contrats.echeances30}><Link href={p("/contrats/calendrier")} className="tnum font-semibold text-ink hover:text-link">{t.contrats.echeances_30j.nb} · <Amount value={t.contrats.echeances_30j.montant} locale={ctx.locale} /></Link></Kv>
                    <Kv label={dict.contrats.assurance}><Badge variant={t.contrats.assurance_immeuble_active ? "ok" : "danger"}>{t.contrats.assurance_immeuble_active ? dict.contrats.assuranceOk : dict.contrats.assuranceAbsente}</Badge></Kv>
                  </div>
                </Card>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[12.5px] text-soft">
              <span className="me-1">{r.genereLe} {formatDateHeure(t.genere_le, ctx.locale)}</span>
              {t.impayes.tranches.map((tr) => <Badge key={tr.tranche} variant={trancheVariant[tr.tranche]}>{dict.enumsRapports.tranche[tr.tranche]} · {tr.nb_lignes}</Badge>)}
            </div>
          </>
        );
      })()}
    </div>
  );
}

/** Ligne clé / valeur (libellé à l'origine, valeur à l'extrémité). */
function Kv({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 text-soft">{label}</span><span className="shrink-0 whitespace-nowrap text-end">{children}</span></div>;
}
