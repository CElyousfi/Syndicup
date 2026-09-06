/** Paie du mois (M20, syndic) — fiches de la période, employés sans fiche, totaux net / coût employeur. */
import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { PaieMois, ParametresPaie } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatMAD } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { StatCard } from "../../../../../components/ui/stat-card";
import { Table, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { FileViewerButton } from "../../../../../components/documents/document-viewer";
import { IconCoins, IconUsers } from "../../../../../components/ui/icons";
import { depenseVariant, fichePaieVariant } from "../../../../../lib/status";
import { ValiderFicheModal, PayerFicheModal } from "../rh-modals";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").personnel.paieMois };
}
function decalerMois(periode: string, delta: number) { const a = Number(periode.slice(0, 4)); const m = Number(periode.slice(5, 7)); return new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7); }

export default async function PaieMoisPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ periode?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN"]);
  const { dict } = ctx;
  const pe = dict.personnel;
  const en = dict.enumsPersonnelRh;
  const p = (path: string) => `/${ctx.locale}${path}`;
  const periode = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.periode ?? "") ? sp.periode! : new Date().toISOString().slice(0, 7);
  const [res, paramsRes] = await Promise.all([
    apiFetch<PaieMois>("/personnel/fiches-paie", { searchParams: { periode } }),
    ctx.coproprieteId ? apiFetch<{ parametres_paie: ParametresPaie | null }>(`/coproprietes/${ctx.coproprieteId}/parametres-paie`) : null,
  ]);
  if (!res.ok) return <div className="space-y-4"><BackLink href={p("/personnel")} label={dict.nav.personnel} /><Banner variant="danger">{pe.chargementImpossible}</Banner></div>;
  const x = res.data;
  const viewer = { see: dict.common.see, close: dict.common.close, download: dict.common.download };
  const nonConfigure = paramsRes?.ok ? paramsRes.data.parametres_paie === null : false;
  return (
    <div className="space-y-5">
      <BackLink href={p("/personnel")} label={dict.nav.personnel} />
      <PageHeader title={`${pe.paieMois} · ${periode}`} subtitle={pe.paieMoisSubtitle} actions={<div className="flex gap-1.5"><ButtonLink href={p(`/personnel/paie?periode=${decalerMois(periode, -1)}`)} variant="secondary" size="sm">{pe.moisPrecedent}</ButtonLink><ButtonLink href={p(`/personnel/paie?periode=${decalerMois(periode, 1)}`)} variant="secondary" size="sm">{pe.moisSuivant}</ButtonLink></div>} />
      {nonConfigure ? <Banner variant="warn"><span className="font-medium">{pe.paieNonConfiguree}.</span> {pe.paieNonConfigureeCorps} <a href={p("/parametres#paie")} className="underline">{dict.nav.parametres}</a></Banner> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<IconUsers width={18} height={18} />} label={pe.fichesPaie} value={String(x.totaux.nb)} hint={`${x.sans_fiche.length} ${pe.sansFiche.toLowerCase()}`} />
        <StatCard icon={<IconCoins width={18} height={18} />} tone="ink" label={pe.totalNet} value={formatMAD(x.totaux.net, ctx.locale)} />
        <StatCard icon={<IconCoins width={18} height={18} />} tone="sage" label={pe.coutEmployeur} value={formatMAD(x.totaux.cout_total_employeur, ctx.locale)} />
      </div>
      <Card>
        <SectionHeader title={pe.fichesPaie} />
        {x.fiches.length === 0 ? <EmptyState title={pe.aucuneFichePaie} /> : (
          <Table>
            <THead><TH>{pe.titre}</TH><TH align="end">{pe.brut}</TH><TH align="end">{pe.net}</TH><TH align="end">{pe.coutEmployeur}</TH><TH>{dict.incidents.statut}</TH><TH></TH></THead>
            <tbody>
              {x.fiches.map((f) => (
                <TR key={f.id}>
                  <TD><a href={p(`/personnel/${f.personnelId}?onglet=paie`)} className="font-medium text-ink-strong hover:text-action">{f.personnel.nom ?? en.poste[f.personnel.poste]}</a><span className="block text-[12px] text-soft">{en.poste[f.personnel.poste]}</span></TD>
                  <TD className="text-end tnum">{formatMAD(f.brut, ctx.locale)}</TD>
                  <TD className="text-end tnum font-medium text-ink-strong">{formatMAD(f.net, ctx.locale)}</TD>
                  <TD className="text-end tnum">{formatMAD(f.coutTotalEmployeur, ctx.locale)}</TD>
                  <TD><div className="flex flex-wrap items-center gap-1"><Badge variant={fichePaieVariant[f.statut]}>{en.statutFichePaie[f.statut]}</Badge>{f.depense ? <a href={p(`/finances/depenses/${f.depense.id}`)}><Badge variant={depenseVariant[f.depense.statut]}>{dict.enumsDepenses.statutDepense[f.depense.statut]}</Badge></a> : null}</div></TD>
                  <TD className="text-end"><div className="flex flex-wrap justify-end gap-1.5">
                    <FileViewerButton src={p(`/api/fiche-paie-pdf?personnel=${f.personnelId}&fiche=${f.id}&langue=${ctx.locale}`)} nom={`fiche-paie-${f.periode}.pdf`} labels={viewer} label={pe.pdfFiche} />
                    {f.statut === "BROUILLON" ? <ValiderFicheModal dict={dict} locale={ctx.locale} fiche={f} /> : null}
                    {f.statut === "VALIDEE" ? <PayerFicheModal dict={dict} locale={ctx.locale} fiche={f} /> : null}
                  </div></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {x.sans_fiche.length ? (
        <Card>
          <SectionHeader title={pe.sansFiche} />
          <ul className="divide-y divide-hairline">
            {x.sans_fiche.map((s) => <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-[13.5px]"><span><a href={p(`/personnel/${s.id}?onglet=paie`)} className="font-medium text-ink-strong hover:text-action">{s.nom}</a> <span className="text-soft">· {en.poste[s.poste]}</span></span><span className="tnum text-soft">{s.salaire_brut_mensuel ? formatMAD(s.salaire_brut_mensuel, ctx.locale) : "—"}</span></li>)}
          </ul>
        </Card>
      ) : null}
      <p className="text-[12px] text-faint">{pe.mentionPaie}</p>
    </div>
  );
}
