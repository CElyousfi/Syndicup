/** Grand livre (M18, syndic / conseil) — journal chronologique de l'exercice + exports csv / xlsx journalisés. */
import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { GrandLivre } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/page-header";
import { Banner } from "../../../../../components/ui/banner";
import { Badge } from "../../../../../components/ui/badge";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { StatCard } from "../../../../../components/ui/stat-card";
import { ExportButtons } from "../../../../../components/ui/export-buttons";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { CCoins, CMoneyBag, CWallet } from "../../../../../components/ui/color-icons";
import { ligneGrandLivreVariant } from "../../../../../lib/status";
import { RapportsTabs, ExerciceLinks } from "../onglets";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").rapports.grandLivreTitre };
}

export default async function GrandLivrePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ exercice?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const r = dict.rapports;
  const exercice = /^\d{4}$/.test(sp.exercice ?? "") ? sp.exercice! : String(new Date().getFullYear());
  const res = await apiFetch<GrandLivre>("/rapports/grand-livre", { searchParams: { exercice } });
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  return (
    <div className="animate-fade">
      <PageHeader title={r.grandLivreTitre} subtitle={r.grandLivreSubtitle} actions={<><ExerciceLinks base="/rapports/grand-livre" exercice={exercice} locale={ctx.locale} /><ExportButtons ressource="grand-livre" filtres={{ exercice }} labels={{ csv: r.exporterCsv, xlsx: r.exporterXlsx, title: r.exportGrandLivreAide }} /></>} />
      <RapportsTabs dict={dict} locale={ctx.locale} active="grandLivre" exercice={exercice} />
      {!res.ok ? <Banner variant="warn">{r.chargementImpossible}</Banner> : (
        <>
          <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={<CWallet />} tone="sage" label={`${r.compteCourant} · ${r.ouverture}`} value={mad(res.data.ouverture.compte_courant)} hint={`${r.reserve} ${mad(res.data.ouverture.reserve)}`} />
            <StatCard icon={<CCoins />} tone="tosca" label={r.entrees} value={mad(res.data.totaux.entrees)} hint={fill(r.nbLignes, { n: res.data.nb_lignes })} />
            <StatCard icon={<CMoneyBag />} tone="sand" label={r.sorties} value={mad(res.data.totaux.sorties_compte_courant)} hint={`${r.reserve} −${mad(res.data.totaux.sorties_reserve)} / +${mad(res.data.totaux.mouvements_reserve)}`} />
            <StatCard icon={<CWallet />} tone={Number(res.data.cloture.compte_courant) >= 0 ? "ok" : "danger"} label={`${r.compteCourant} · ${r.cloture}`} value={mad(res.data.cloture.compte_courant)} hint={`${r.reserve} ${mad(res.data.cloture.reserve)}`} />
          </div>
          {res.data.lignes.length === 0 ? <EmptyState title={r.aucuneLigne} /> : (
            <TableCard>
              <Table>
                <THead><TH>{r.date}</TH><TH>{r.type}</TH><TH>{r.libelle}</TH><TH>{r.tiers}</TH><TH>{r.reference}</TH><TH align="end">{r.entree}</TH><TH align="end">{r.sortie}</TH><TH align="end">{r.soldeCourant}</TH><TH align="end">{r.soldeReserve}</TH></THead>
                <tbody>
                  {res.data.lignes.map((l) => (
                    <TR key={`${l.entite}-${l.entite_id}`}>
                      <TD className="tnum text-soft">{formatDate(l.date, ctx.locale)}</TD>
                      <TD><Badge variant={ligneGrandLivreVariant[l.type]}>{dict.enumsRapports.typeLigne[l.type]}</Badge><span className="block text-[11px] text-faint">{dict.enumsRapports.compte[l.compte]}</span></TD>
                      <TD className="font-medium text-ink">{l.libelle}{l.categorie ? <span className="block text-[12px] text-faint">{l.categorie}</span> : null}</TD>
                      <TD className="text-body">{l.tiers ?? "—"}</TD>
                      <TD className="text-body"><span dir="ltr">{l.reference ?? "—"}</span></TD>
                      <TD align="end" className="tnum text-ok">{l.entree ? mad(l.entree) : ""}</TD>
                      <TD align="end" className="tnum text-danger">{l.sortie ? mad(l.sortie) : ""}</TD>
                      <TD align="end" className="tnum font-medium text-ink">{mad(l.solde_compte_courant)}</TD>
                      <TD align="end" className="tnum text-body">{mad(l.solde_reserve)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}
        </>
      )}
    </div>
  );
}
