import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../../lib/app-context";
import { apiFetch } from "../../../../../../lib/api/client";
import type { BudgetAg, BudgetPoste, BudgetVsRealise } from "../../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../../lib/i18n";
import { formatMAD } from "../../../../../../lib/format";
import { versCentimes, versChaine } from "../../../../../../lib/centimes";
import { PageHeader, BackLink } from "../../../../../../components/page-header";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { Card, SectionHeader } from "../../../../../../components/ui/card";
import { StatCard } from "../../../../../../components/ui/stat-card";
import { Bars } from "../../../../../../components/ui/charts";
import { ProgressBar } from "../../../../../../components/ui/progress";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../../components/ui/table";
import { CCoins, CMoneyBag, CWallet } from "../../../../../../components/ui/color-icons";
import { budgetVariant } from "../../../../../../lib/status";
import { ActiverBudgetModal } from "../budget-modals";
import { AjouterPosteModal, ModifierPosteModal, SupprimerPosteBouton } from "./postes-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").depenses.postes };
}

export default async function BudgetDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const d = dict.depenses;
  const f = dict.finances;
  const e = dict.enumsDepenses;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const voitRealise = gestion || ctx.roles.includes("CONSEIL_SYNDICAL");
  const p = (path: string) => `/${locale}${path}`;

  const postesRes = await apiFetch<{ budget: BudgetAg; postes: BudgetPoste[] }>(`/finances/budgets/${id}/postes`);
  if (!postesRes.ok) notFound();
  const { budget, postes } = postesRes.data;
  const rapportRes = voitRealise && budget.statut === "ACTIF" ? await apiFetch<BudgetVsRealise>("/finances/budget-vs-realise", { searchParams: { exercice: budget.exercice } }) : null;
  const rapport = rapportRes?.ok && rapportRes.data.budget?.id === budget.id ? rapportRes.data : null;
  const ligneDe = (posteId: string) => rapport?.postes.find((l) => l.poste_id === posteId);
  const total = versCentimes(budget.montantTotal);
  const maxPrevu = postes.reduce((m, x) => (versCentimes(x.montantPrevu) > m ? versCentimes(x.montantPrevu) : m), 0n);
  const actif = budget.statut === "ACTIF";

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={p("/finances/budgets")} label={f.budgets} />}
        title={`${f.exercice} ${budget.exercice}`}
        badge={<Badge variant={budgetVariant[budget.statut]}>{dict.enums.statutBudget[budget.statut]}</Badge>}
        subtitle={d.postesSubtitle}
        actions={
          gestion && budget.statut !== "REMPLACE" ? (
            <>
              <AjouterPosteModal dict={dict} locale={ctx.locale} budgetId={id} actif={actif} />
              {budget.statut === "PROPOSE" || budget.statut === "VOTE" ? <ActiverBudgetModal dict={dict} locale={ctx.locale} budget={budget} /> : null}
            </>
          ) : undefined
        }
      />

      {actif && gestion ? <Banner variant="info" className="mb-4">{d.posteModifieApresActivation}</Banner> : null}

      <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={<CWallet />} tone="sage" label={f.montantVote} value={formatMAD(budget.montantTotal, ctx.locale)} hint={`${postes.length} ${d.postes.toLowerCase()}`} />
        {rapport ? (
          <>
            <StatCard icon={<CCoins />} tone="tosca" label={d.engage} value={formatMAD(rapport.totaux.engage, ctx.locale)} hint={d.engageAide} />
            <StatCard icon={<CMoneyBag />} tone={rapport.totaux.depassement ? "danger" : "sage"} label={d.realise} value={formatMAD(rapport.totaux.realise, ctx.locale)} trend={rapport.totaux.pourcentage_realise ? `${rapport.totaux.pourcentage_realise} %` : undefined} trendTone={rapport.totaux.depassement ? "danger" : "ok"} hint={rapport.totaux.ecart ? `${d.ecart} : ${formatMAD(rapport.totaux.ecart, ctx.locale)}` : undefined} />
          </>
        ) : null}
      </div>

      {rapport && postes.length > 0 ? (
        <Card className="mb-4">
          <SectionHeader title={d.prevuVsRealise} subtitle={d.prevuVsRealiseAide} action={<Link href={p(`/finances/depenses?exercice=${budget.exercice}`)} className="text-[13px] font-medium text-action hover:underline">{d.voirDepenses}</Link>} />
          <Bars
            className="mt-6"
            height={220}
            items={postes.map((x) => {
              const l = ligneDe(x.id);
              const prevu = versCentimes(x.montantPrevu);
              const consomme = versCentimes(l?.consomme ?? "0");
              return {
                label: x.libelle.length > 18 ? `${x.libelle.slice(0, 17)}…` : x.libelle,
                totalRatio: maxPrevu > 0n ? Number(prevu) / Number(maxPrevu) : 0,
                paidRatio: prevu > 0n ? Math.min(1, Number(consomme) / Number(prevu)) : 0,
                displayTotal: formatMAD(x.montantPrevu, ctx.locale),
                displayPaid: formatMAD(versChaine(consomme), ctx.locale),
                active: Boolean(l?.depassement),
              };
            })}
            yTop={formatMAD(versChaine(maxPrevu), ctx.locale)}
            yMid={formatMAD(versChaine(maxPrevu / 2n), ctx.locale)}
            legendPaid={d.consomme}
            legendTotal={d.prevu}
          />
        </Card>
      ) : null}

      <TableCard>
        <Table>
          <THead>
            <TH>{d.poste_libelle}</TH>
            <TH>{d.categorie}</TH>
            <TH align="end">{d.montantPrevu}</TH>
            {rapport ? <TH align="end">{d.consomme}</TH> : null}
            {rapport ? <TH>{d.prevuVsRealise}</TH> : null}
            {gestion && budget.statut !== "REMPLACE" ? <TH align="end" /> : null}
          </THead>
          <tbody>
            {postes.map((x) => {
              const l = ligneDe(x.id);
              const part = total > 0n ? Number(versCentimes(x.montantPrevu)) / Number(total) : 0;
              const ratio = l && l.montant_prevu ? Number(versCentimes(l.consomme)) / Math.max(1, Number(versCentimes(l.montant_prevu))) : 0;
              return (
                <TR key={x.id}>
                  <TD className="font-medium text-ink">
                    {x.libelle}
                    <span className="tnum block text-[12px] font-normal text-faint">{Math.round(part * 100)} %</span>
                  </TD>
                  <TD className="text-body">{e.categorieDepense[x.categorie]}</TD>
                  <TD align="end" className="tnum font-medium text-ink">{formatMAD(x.montantPrevu, ctx.locale)}</TD>
                  {rapport ? <TD align="end" className={`tnum ${l?.depassement ? "font-semibold text-danger" : "text-body"}`}>{l ? formatMAD(l.consomme, ctx.locale) : "—"}</TD> : null}
                  {rapport ? (
                    <TD>
                      <div className="min-w-[120px]">
                        <ProgressBar ratio={Math.min(1, ratio)} tone={l?.depassement ? "danger" : ratio > 0.85 ? "warn" : "ok"} />
                        <span className="tnum mt-1 block text-[12px] text-faint">{l?.pourcentage_consomme ? `${l.pourcentage_consomme} %` : "0 %"}{l?.depassement ? ` · ${d.depassement}` : ""}</span>
                      </div>
                    </TD>
                  ) : null}
                  {gestion && budget.statut !== "REMPLACE" ? (
                    <TD align="end">
                      <span className="inline-flex items-center gap-1">
                        <ModifierPosteModal dict={dict} locale={ctx.locale} budgetId={id} poste={x} actif={actif} />
                        {postes.length > 1 ? <SupprimerPosteBouton dict={dict} locale={ctx.locale} budgetId={id} poste={x} /> : null}
                      </span>
                    </TD>
                  ) : null}
                </TR>
              );
            })}
          </tbody>
          <tfoot>
            <TR>
              <TD colSpan={2} className="text-[13px] text-soft">{f.montantVote}</TD>
              <TD align="end" className="tnum font-semibold text-ink">{formatMAD(budget.montantTotal, ctx.locale)}</TD>
              {rapport ? <TD align="end" className="tnum font-semibold text-ink">{formatMAD(rapport.totaux.consomme, ctx.locale)}</TD> : null}
              {rapport ? <TD /> : null}
              {gestion && budget.statut !== "REMPLACE" ? <TD /> : null}
            </TR>
          </tfoot>
        </Table>
      </TableCard>

      {rapport && rapport.hors_poste.length > 0 ? (
        <Card className="mt-4">
          <SectionHeader title={d.horsPoste} subtitle={d.parCategorie} />
          <ul className="mt-3 divide-y divide-hairline text-sm">
            {rapport.hors_poste.map((h) => (
              <li key={h.categorie} className="flex items-center justify-between gap-3 py-2">
                <span className="text-body">{e.categorieDepense[h.categorie]}</span>
                <span className="tnum font-medium text-ink">{formatMAD(h.consomme, ctx.locale)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
