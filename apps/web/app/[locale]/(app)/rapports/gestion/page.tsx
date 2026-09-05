/** Rapports de gestion annuels (M18) — liste, génération (syndic), accès au détail. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { BudgetAg, RapportGestion } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD, nomComplet } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { rapportVariant } from "../../../../../lib/status";
import { RapportsTabs } from "../onglets";
import { GenererModal } from "../rapport-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.gestionTitre };
}

export default async function RapportsGestionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const r = dict.rapports;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((x) => ctx.roles.includes(x as never));
  const [res, budgetsRes] = await Promise.all([apiFetch<RapportGestion[]>("/rapports/gestion", { searchParams: { limit: 100 } }), gestion ? apiFetch<BudgetAg[]>("/finances/budgets") : Promise.resolve(null)]);
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  const rows = res.ok ? res.data : [];
  return (
    <div className="animate-fade">
      <PageHeader title={r.gestionTitre} subtitle={r.gestionSubtitle} actions={gestion ? <GenererModal dict={dict} locale={ctx.locale} budgets={budgetsRes?.ok ? budgetsRes.data : []} exerciceDefaut={String(new Date().getFullYear() - 1)} /> : undefined} />
      <RapportsTabs dict={dict} locale={ctx.locale} active="gestion" />
      {!res.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : rows.length === 0 ? <EmptyState title={r.aucunRapport} hint={r.aucunRapportAide} /> : (
        <TableCard>
          <Table>
            <THead><TH>{r.exercice}</TH><TH>{r.statut}</TH><TH align="end">{r.compteCourant}</TH><TH align="end">{r.recouvrement}</TH><TH align="end">{r.impayes}</TH><TH align="end">{r.depenses}</TH><TH>{r.generePar}</TH></THead>
            <tbody>
              {rows.map((x) => (
                <TR key={x.id}>
                  <TD className="tnum font-semibold text-ink"><Link href={p(`/rapports/gestion/${x.id}`)} className="hover:text-action">{x.exercice}</Link></TD>
                  <TD><Badge variant={rapportVariant[x.statut]}>{dict.enumsRapports.statutRapport[x.statut]}</Badge>{x.ag ? <span className="block text-[11px] text-faint">{dict.nav.ag} · {formatDate(x.ag.date_ag, ctx.locale)}</span> : null}</TD>
                  <TD align="end" className="tnum text-ink">{mad(x.resume.compte_courant_cloture)}</TD>
                  <TD align="end" className="tnum text-body">{x.resume.taux_recouvrement ? `${x.resume.taux_recouvrement} %` : "—"}</TD>
                  <TD align="end" className="tnum text-danger">{mad(x.resume.impayes_total)}<span className="block text-[11px] text-faint">{fill(r.lotsEnRetard, { n: x.resume.nb_lots_en_retard })}</span></TD>
                  <TD align="end" className="tnum text-body">{mad(x.resume.depenses_total)}</TD>
                  <TD className="text-body">{nomComplet(x.genere_par) ?? "—"}<span className="block text-[11px] text-faint">{formatDate(x.genere_le, ctx.locale)}</span></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
