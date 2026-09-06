/** Contrats (M19, syndic / conseil) — liste par statut / type, assurance, à renouveler, échéances sous 30 jours, export csv / xlsx. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { Contrat, Echeancier, EtatAssurance, StatutContrat, TypeContrat } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDate, formatMAD } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../components/ui/link-tabs";
import { StatCard } from "../../../../components/ui/stat-card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { CAlert, CCalendar, CHandshake, CShield } from "../../../../components/ui/color-icons";
import { IconPlus } from "../../../../components/ui/icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";
import { contratVariant } from "../../../../lib/status";
import { FiltreType } from "./filtre-type";

const ONGLETS = ["TOUS", "ACTIF", "A_RENOUVELER", "BROUILLON", "SUSPENDU", "EXPIRE", "RESILIE"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").contrats.titre };
}

export default async function ContratsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ statut?: string; type?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"]);
  const { dict } = ctx;
  const c = dict.contrats;
  const e = dict.enumsContrats;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const onglet = (ONGLETS as readonly string[]).includes(sp.statut ?? "") ? (sp.statut as (typeof ONGLETS)[number]) : "TOUS";
  const type = sp.type && sp.type in e.typeContrat ? (sp.type as TypeContrat) : undefined;
  const p = (path: string) => `/${locale}${path}`;
  const mad = (v: string | null | undefined) => formatMAD(v, ctx.locale);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [listeRes, renouvRes, assuranceRes, echRes] = await Promise.all([
    onglet === "A_RENOUVELER" ? apiFetch<Contrat[]>("/contrats/a-renouveler", { searchParams: { jours: 90 } }) : apiFetch<Contrat[]>("/contrats", { searchParams: { limit: 100, statut: onglet === "TOUS" ? undefined : onglet, type } }),
    apiFetch<Contrat[]>("/contrats/a-renouveler", { searchParams: { jours: 90 } }),
    apiFetch<EtatAssurance>("/contrats/assurance"),
    apiFetch<Echeancier>("/contrats/echeancier", { searchParams: { from: iso(new Date()), to: iso(new Date(Date.now() + 30 * 86_400_000)) } }),
  ]);
  const prochaines = echRes.ok ? echRes.data.echeances.filter((x) => x.statut === "A_VENIR" || x.statut === "MANQUEE") : [];
  const rows = (listeRes.ok ? listeRes.data : []).filter((x) => !type || x.type === type);
  const parStatut = listeRes.ok ? ((listeRes.meta as { par_statut?: Partial<Record<StatutContrat, number>> }).par_statut ?? {}) : {};
  const aRenouveler = renouvRes.ok ? renouvRes.data : [];
  const assurance = assuranceRes.ok ? assuranceRes.data : null;
  const qs = (statut: string) => `${p("/contrats")}?${new URLSearchParams({ ...(statut !== "TOUS" ? { statut } : {}), ...(type ? { type } : {}) }).toString()}`.replace(/\?$/, "");

  return (
    <div className="animate-fade">
      <PageHeader title={c.titre} subtitle={c.subtitle} actions={<><ButtonLink href={p("/contrats/calendrier")} variant="secondary"><CCalendar className="h-4 w-4" />{c.calendrier}</ButtonLink>{gestion ? <ButtonLink href={p("/contrats/nouveau")}><IconPlus width={16} height={16} />{c.nouveau}</ButtonLink> : null}</>} />
      {assurance && !assurance.immeuble_active ? <Banner variant="danger" className="mb-4" title={c.assuranceAbsente} action={gestion ? <Link href={p("/contrats/nouveau?type=ASSURANCE_IMMEUBLE")} className="font-medium underline">{c.nouveau}</Link> : undefined}>{c.assuranceAbsenteCorps}</Banner> : null}
      {!listeRes.ok ? <Banner variant="warn" className="mb-4">{c.chargementImpossible}</Banner> : null}
      <div className="stat mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CHandshake />} tone="sage" label={c.actifs} value={String(parStatut.ACTIF ?? 0)} href={qs("ACTIF")} />
        <StatCard icon={<CAlert />} tone={aRenouveler.length > 0 ? "warn" : "sage"} label={c.aRenouveler} value={String(aRenouveler.length)} hint={c.aRenouvelerAide} href={qs("A_RENOUVELER")} />
        <StatCard icon={<CCalendar />} tone="tosca" label={c.echeances30} value={String(prochaines.length)} hint={echRes.ok && prochaines.length ? mad(echRes.data.total_montant) : undefined} href={p("/contrats/calendrier")} />
        <StatCard icon={<CShield />} tone={assurance?.immeuble_active ? "ok" : "danger"} label={c.assurance} value={assurance?.immeuble_active ? "✓" : "✗"} trend={assurance?.immeuble_active ? c.assuranceOk : c.assuranceAbsente} trendTone={assurance?.immeuble_active ? "ok" : "danger"} hint={assurance?.rc_active ? `${c.assuranceRc} ✓` : undefined} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LinkTabs tabs={ONGLETS.map((o) => ({ href: qs(o), label: o === "TOUS" ? c.tous : o === "A_RENOUVELER" ? c.aRenouveler : e.statutContrat[o as StatutContrat], active: onglet === o, count: o === "A_RENOUVELER" ? aRenouveler.length : o === "TOUS" ? undefined : parStatut[o as StatutContrat] }))} />
        <div className="flex items-center gap-2">
          <FiltreType dict={dict} locale={ctx.locale} statut={onglet} type={type ?? ""} />
          <ExportButtons ressource="contrats" filtres={{ type, statut: onglet === "TOUS" || onglet === "A_RENOUVELER" ? undefined : onglet }} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx }} size="sm" />
        </div>
      </div>
      {rows.length === 0 ? <EmptyState title={onglet === "TOUS" && !type ? c.aucun : c.aucunFiltre} hint={onglet === "TOUS" && !type && gestion ? c.aucunAide : undefined} /> : (
        <TableCard>
          <Table>
            <THead><TH>{c.libelle}</TH><TH>{c.type}</TH><TH>{c.prestataire}</TH><TH>{c.periodicite}</TH><TH align="end">{c.montantPeriode}</TH><TH>{c.dateFin}</TH><TH>{c.statut}</TH></THead>
            <tbody>
              {rows.map((x) => (
                <TR key={x.id}>
                  <TD className="font-semibold text-ink"><Link href={p(`/contrats/${x.id}`)} className="hover:text-action">{x.libelle}</Link>{x.reference ? <span className="block text-[12px] text-faint" dir="ltr">{x.reference}</span> : null}</TD>
                  <TD className="text-body">{e.typeContrat[x.type]}</TD>
                  <TD className="text-body">{x.prestataire?.nom ?? "—"}</TD>
                  <TD className="text-body">{e.periodicite[x.periodicite]}{x.tacite ? <span className="block text-[11px] text-faint">{c.tacite}</span> : null}</TD>
                  <TD align="end" className="tnum text-ink">{mad(x.montantPeriode)}</TD>
                  <TD className="tnum text-soft">{x.dateFin ? formatDate(x.dateFin, ctx.locale) : c.dureeIndeterminee}{x.jours_avant_fin !== null && x.statut === "ACTIF" ? <span className={`block text-[11px] ${x.jours_avant_fin <= 30 ? "text-danger" : x.jours_avant_fin <= 90 ? "text-warn" : "text-faint"}`}>{fill(c.joursAvantFin, { n: x.jours_avant_fin })}</span> : null}{x.statut === "EXPIRE" && x.jours_avant_fin !== null ? <span className="block text-[11px] text-danger">{fill(c.expireDepuis, { n: -x.jours_avant_fin })}</span> : null}</TD>
                  <TD><Badge variant={contratVariant[x.statut]}>{e.statutContrat[x.statut]}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
