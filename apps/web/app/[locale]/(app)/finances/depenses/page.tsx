import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { BudgetVsRealise, Depense, DepensesTotaux, StatutDepense, CategorieDepense } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { STATUTS_ONGLETS } from "../../../../../lib/depenses";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { Pagination } from "../../../../../components/ui/pagination";
import { StatCard } from "../../../../../components/ui/stat-card";
import { CCoins, CMoneyBag, CWallet, CAlert } from "../../../../../components/ui/color-icons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { IconPlus } from "../../../../../components/ui/icons";
import { ExportButtons } from "../../../../../components/ui/export-buttons";
import { depenseVariant } from "../../../../../lib/status";
import { FiltresDepenses } from "./filtres";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.depenses };
}

export default async function DepensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; statut?: string; categorie?: string; source?: string; exercice?: string; q?: string; contrat_id?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const d = dict.depenses;
  const e = dict.enumsDepenses;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const p = (path: string) => `/${locale}${path}`;

  const exercice = /^\d{4}$/.test(sp.exercice ?? "") ? sp.exercice! : String(new Date().getFullYear());
  const statut = STATUTS_ONGLETS.includes(sp.statut as StatutDepense) && sp.statut !== "TOUS" ? (sp.statut as StatutDepense) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const filtres = { exercice, statut, categorie: sp.categorie || undefined, source: sp.source || undefined, q: sp.q || undefined, contrat_id: sp.contrat_id || undefined };

  const [listeRes, rapportRes] = await Promise.all([
    apiFetch<Depense[]>("/depenses", { searchParams: { ...filtres, page, limit: 25, sort: "-date_depense" } }),
    apiFetch<BudgetVsRealise>("/finances/budget-vs-realise", { searchParams: { exercice } }),
  ]);
  const depenses = listeRes.ok ? listeRes.data : [];
  const totaux = listeRes.ok ? ((listeRes.meta as { totaux?: DepensesTotaux }).totaux ?? null) : null;
  const rapport = rapportRes.ok ? rapportRes.data : null;

  const qs = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ exercice, statut: sp.statut, categorie: sp.categorie, source: sp.source, q: sp.q, ...over })) {
      if (v && v !== "TOUS") u.set(k, v);
    }
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={d.titre}
        subtitle={d.subtitle}
        actions={
          <>
            <ExportButtons ressource="depenses" filtres={filtres} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx, title: d.exporterCsvAide }} />
            {gestion ? (
              <ButtonLink href={p("/finances/depenses/nouvelle")}>
                <IconPlus width={16} height={16} />
                {d.nouvelle}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {rapport?.seuil_non_configure && gestion ? (
        <Banner variant="legal" className="mb-4" title={d.seuilNonConfigure} action={<Link href={p("/parametres")} className="font-medium underline">{dict.nav.parametres}</Link>}>
          {d.seuilNonConfigureCorps}
        </Banner>
      ) : null}
      {!listeRes.ok ? <Banner variant="warn" className="mb-4">{d.chargementImpossible}</Banner> : null}

      {rapport ? (
        <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<CAlert />} tone={rapport.nb_a_approuver > 0 ? "warn" : "sage"} label={d.aApprouver} value={String(rapport.nb_a_approuver)} hint={totaux?.par_statut.A_APPROUVER ? formatMAD(totaux.par_statut.A_APPROUVER.montant_ttc, ctx.locale) : undefined} href={p(`/finances/depenses${qs({ statut: "A_APPROUVER" })}`)} />
          <StatCard icon={<CCoins />} tone="tosca" label={d.engage} value={formatMAD(rapport.totaux.engage, ctx.locale)} hint={d.engageAide} />
          <StatCard icon={<CMoneyBag />} tone="sage" label={d.realise} value={formatMAD(rapport.totaux.realise, ctx.locale)} hint={rapport.totaux.montant_prevu ? `${d.prevu} : ${formatMAD(rapport.totaux.montant_prevu, ctx.locale)}` : d.aucunBudgetActif} trend={rapport.totaux.pourcentage_realise ? `${rapport.totaux.pourcentage_realise} %` : undefined} trendTone={rapport.totaux.depassement ? "danger" : "ok"} />
          <StatCard icon={<CWallet />} tone="lilac" label={d.reserveSolde} value={formatMAD(rapport.fonds_reserve.solde, ctx.locale)} hint={rapport.budget ? <Link href={p(`/finances/budgets/${rapport.budget.id}`)} className="text-action hover:underline">{d.budgetVsRealise}</Link> : undefined} />
        </div>
      ) : null}

      <LinkTabs
        className="mb-4"
        tabs={STATUTS_ONGLETS.map((s) => ({
          href: p(`/finances/depenses${qs({ statut: s === "TOUS" ? undefined : s, page: undefined })}`),
          label: s === "TOUS" ? d.tous : e.statutDepense[s],
          active: s === "TOUS" ? !statut : statut === s,
          count: s === "TOUS" ? undefined : totaux?.par_statut[s]?.nb,
        }))}
      />

      <FiltresDepenses dict={dict} locale={ctx.locale} valeurs={{ exercice, categorie: sp.categorie ?? "", source: sp.source ?? "", q: sp.q ?? "", statut: sp.statut ?? "" }} />

      {depenses.length === 0 ? (
        <EmptyState
          title={sp.categorie || sp.source || sp.q || statut ? d.aucuneFiltre : d.aucune}
          hint={gestion && !statut ? d.aucuneAide : undefined}
          action={gestion ? <ButtonLink href={p("/finances/depenses/nouvelle")}>{d.nouvelle}</ButtonLink> : undefined}
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <TH>{d.date}</TH>
                <TH>{d.libelle}</TH>
                <TH>{d.categorie}</TH>
                <TH>{d.prestataire}</TH>
                <TH>{d.statut}</TH>
                <TH align="end">{d.montantTtc}</TH>
              </THead>
              <tbody>
                {depenses.map((x) => (
                  <TR key={x.id}>
                    <TD className="tnum text-soft">{formatDate(x.dateDepense, ctx.locale)}</TD>
                    <TD className="font-medium text-ink">
                      <Link href={p(`/finances/depenses/${x.id}`)} className="hover:text-action">{x.libelle}</Link>
                      {x.budgetPoste ? <span className="block text-[12px] font-normal text-faint">{x.budgetPoste.libelle}</span> : null}
                      {x.source === "FONDS_RESERVE" ? <Badge variant="info" className="ms-2">{e.sourceFinancement.FONDS_RESERVE}</Badge> : null}
                    </TD>
                    <TD className="text-body">{e.categorieDepense[x.categorie as CategorieDepense]}</TD>
                    <TD className="text-body">{x.prestataire ? <Link href={p(`/prestataires/${x.prestataire.id}`)} className="hover:text-action">{x.prestataire.nom}</Link> : <span className="text-faint">{dict.common.none}</span>}</TD>
                    <TD><Badge variant={depenseVariant[x.statut]}>{e.statutDepense[x.statut]}</Badge></TD>
                    <TD align="end" className="tnum font-medium text-ink">{formatMAD(x.montantTtc, ctx.locale)}</TD>
                  </TR>
                ))}
              </tbody>
              {totaux ? (
                <tfoot>
                  <TR>
                    <TD colSpan={5} className="text-[13px] text-soft">{fill(d.totalFiltre, {})}</TD>
                    <TD align="end" className="tnum font-semibold text-ink">{formatMAD(totaux.montant_ttc, ctx.locale)}</TD>
                  </TR>
                </tfoot>
              ) : null}
            </Table>
          </TableCard>
          {listeRes.ok ? <Pagination meta={listeRes.meta} basePath={p("/finances/depenses")} searchParams={{ exercice, statut: sp.statut, categorie: sp.categorie, source: sp.source, q: sp.q }} dict={dict} /> : null}
        </>
      )}
    </div>
  );
}
