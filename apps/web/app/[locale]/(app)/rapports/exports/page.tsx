/** Centre d'exports (M18, syndic / conseil) — csv / xlsx par ressource, journal export_log, option factures visibles. */
import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { ExportLog } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { Banner } from "../../../../../components/ui/banner";
import { ExportButtons } from "../../../../../components/ui/export-buttons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { RapportsTabs } from "../onglets";
import { FacturesToggle } from "../rapport-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.exportsTitre };
}

export default async function ExportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const r = dict.rapports;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((x) => ctx.roles.includes(x as never));
  const exercice = String(new Date().getFullYear());
  const [journal, copro] = await Promise.all([apiFetch<ExportLog[]>("/rapports/exports", { searchParams: { limit: 50 } }), ctx.coproprieteId ? apiFetch<{ facturesVisiblesResidents?: boolean }>(`/coproprietes/${ctx.coproprieteId}`) : Promise.resolve(null)]);
  const labels = { csv: r.exporterCsv, xlsx: r.exporterXlsx };
  const cartes: { titre: string; aide: string; ressource: "lots" | "paiements" | "incidents" | "depenses" | "grand-livre" | "impayes" | "proprietaires" | "contrats"; filtres?: Record<string, string>; syndicSeul?: boolean }[] = [
    { titre: r.exportLots, aide: r.exportLotsAide, ressource: "lots" },
    { titre: r.exportProprietaires, aide: r.exportProprietairesAide, ressource: "proprietaires", syndicSeul: true },
    { titre: r.exportImpayes, aide: r.exportImpayesAide, ressource: "impayes" },
    { titre: r.exportPaiements, aide: r.exportPaiementsAide, ressource: "paiements", filtres: { exercice } },
    { titre: r.exportDepenses, aide: r.exportDepensesAide, ressource: "depenses", filtres: { exercice } },
    { titre: r.exportGrandLivre, aide: r.exportGrandLivreAide, ressource: "grand-livre", filtres: { exercice } },
    { titre: r.exportIncidents, aide: r.exportIncidentsAide, ressource: "incidents" },
    { titre: dict.contrats.titre, aide: dict.contrats.subtitle, ressource: "contrats" },
  ];
  return (
    <div className="animate-fade">
      <PageHeader title={r.exportsTitre} subtitle={r.exportsSubtitle} />
      <RapportsTabs dict={dict} locale={ctx.locale} active="exports" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cartes.filter((c) => gestion || !c.syndicSeul).map((c) => (
          <Card key={c.ressource} className="flex flex-col justify-between gap-3">
            <div><p className="text-sm font-semibold text-ink">{c.titre}</p><p className="mt-1 text-[13px] text-soft">{c.aide}</p></div>
            <ExportButtons ressource={c.ressource} filtres={c.filtres} labels={labels} size="sm" />
          </Card>
        ))}
      </div>
      {gestion && ctx.coproprieteId ? (
        <Card className="mt-4">
          <SectionHeader title={r.facturesVisibles} subtitle={r.facturesVisiblesAide} />
          <div className="mt-3"><FacturesToggle dict={dict} locale={ctx.locale} coproprieteId={ctx.coproprieteId} visible={copro?.ok ? copro.data.facturesVisiblesResidents === true : false} /></div>
        </Card>
      ) : null}
      <div className="mt-6">
        <SectionHeader title={r.journal} subtitle={r.journalAide} className="mb-3" />
        {!journal.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : journal.data.length === 0 ? <p className="text-sm text-soft">{r.journalVide}</p> : (
          <TableCard>
            <Table>
              <THead><TH>{r.quand}</TH><TH>{r.qui}</TH><TH>{r.quoi}</TH><TH>{r.format}</TH><TH align="end">{r.nbLignesCol}</TH></THead>
              <tbody>
                {journal.data.map((e) => (
                  <TR key={e.id}>
                    <TD className="tnum text-soft">{formatDateHeure(e.horodatage, ctx.locale)}</TD>
                    <TD className="text-body">{nomComplet(e.utilisateur) ?? "—"}</TD>
                    <TD className="font-medium text-ink">{e.type}{e.filtres && "exercice" in e.filtres && e.filtres.exercice ? <span className="ms-1 text-[12px] text-faint">· {String(e.filtres.exercice)}</span> : null}</TD>
                    <TD className="text-body uppercase">{String(e.filtres?.format ?? "csv")}</TD>
                    <TD align="end" className="tnum text-body">{e.nb_lignes}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableCard>
        )}
      </div>
    </div>
  );
}
