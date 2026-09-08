/** Tâches (M22) — liste ou kanban, filtres (statut, priorité, origine, retard), export ; syndic / conseil : registre ; gardien : ses tâches. */
import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, exigerRole } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { OrigineTache, PrioriteTache, StatutTache, Tache } from "../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../lib/i18n";
import { formatDate, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Banner } from "../../../../components/ui/banner";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { LinkTabs } from "../../../../components/ui/link-tabs";
import { StatCard } from "../../../../components/ui/stat-card";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { IconPlus, IconTasks } from "../../../../components/ui/icons";
import { CAlert, CCalendar, CWrench } from "../../../../components/ui/color-icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";
import { prioriteVariant, tacheVariant } from "../../../../lib/status";

const STATUTS: StatutTache[] = ["A_FAIRE", "EN_COURS", "BLOQUEE", "TERMINEE", "ANNULEE"];
const COLONNES: StatutTache[] = ["A_FAIRE", "EN_COURS", "BLOQUEE", "TERMINEE"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").taches.titre };
}

export default async function TachesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ vue?: string; statut?: string; priorite?: string; origine?: string; retard?: string; cree?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const t = dict.taches;
  const e = dict.enumsTaches;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const gardien = !gestion && !ctx.roles.includes("CONSEIL_SYNDICAL" as never);
  const vue = sp.vue === "kanban" ? "kanban" : "liste";
  const statut = STATUTS.includes(sp.statut as StatutTache) ? (sp.statut as StatutTache) : undefined;
  const priorite = ["BASSE", "NORMALE", "HAUTE", "CRITIQUE"].includes(sp.priorite ?? "") ? (sp.priorite as PrioriteTache) : undefined;
  const origine = ["MANUELLE", "RESOLUTION_AG", "CONTRAT", "INCIDENT", "RAPPORT", "SYSTEME"].includes(sp.origine ?? "") ? (sp.origine as OrigineTache) : undefined;
  const retard = sp.retard === "1";
  const p = (path: string) => `/${locale}${path}`;
  const res = gardien
    ? await apiFetch<Tache[]>("/taches/mes-taches")
    : await apiFetch<Tache[]>("/taches", { searchParams: { limit: 100, statut, priorite, origine, retard: retard ? "1" : undefined, ouvertes: !statut && !retard && vue === "liste" ? "1" : undefined } });
  const rows = res.ok ? res.data : [];
  const meta = res.ok ? (res.meta as { par_statut?: Partial<Record<StatutTache, number>>; retard?: number }) : {};
  const parStatut = meta.par_statut ?? {};
  const nbRetard = meta.retard ?? rows.filter((x) => x.enRetard).length;
  const qs = (o: { statut?: string; priorite?: string; origine?: string; retard?: string; vue?: string }) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ vue: vue === "kanban" ? "kanban" : undefined, statut, priorite, origine, retard: retard ? "1" : undefined, ...o })) if (v) u.set(k, v); const q = u.toString(); return `${p("/taches")}${q ? `?${q}` : ""}`; };
  const ouverts = (parStatut.A_FAIRE ?? 0) + (parStatut.EN_COURS ?? 0) + (parStatut.BLOQUEE ?? 0);
  const ligne = (x: Tache) => (
    <Link key={x.id} href={p(`/taches/${x.id}`)} className={`block rounded-field border bg-surface p-3 transition-colors hover:bg-hover ${x.enRetard ? "border-danger/40" : "border-hairline"}`}>
      <div className="flex flex-wrap items-center gap-1.5"><Badge variant={prioriteVariant[x.priorite]}>{e.priorite[x.priorite]}</Badge><span className="text-[11px] text-faint">{e.origine[x.origine]}</span></div>
      <p className="mt-1.5 text-[13.5px] font-medium text-ink-strong">{x.titre}</p>
      <p className="mt-1 text-[12px] text-soft">{x.dateEcheance ? formatDate(x.dateEcheance, ctx.locale) : t.sansEcheance}{x.assignee ? ` · ${nomComplet(x.assignee) ?? ""}` : ""}{x.checklist?.length ? ` · ${fill(t.checklistProgres, { n: x.checklistFaits, total: x.checklist.length })}` : ""}</p>
      {x.enRetard ? <Badge variant="danger" className="mt-1.5">{t.enRetard}</Badge> : null}
    </Link>
  );

  return (
    <div className="animate-fade">
      <PageHeader
        title={gardien ? t.mesTaches : t.titre}
        subtitle={gardien ? t.mesTachesSubtitle : t.subtitle}
        actions={<div className="flex flex-wrap gap-2">
          {!gardien ? <LinkTabs tabs={[{ href: qs({ vue: undefined }), label: t.vueListe, active: vue === "liste" }, { href: qs({ vue: "kanban" }), label: t.vueKanban, active: vue === "kanban" }]} /> : null}
          {!gardien ? <ExportButtons ressource="taches" filtres={{ statut, priorite, origine, retard: retard ? "1" : undefined }} labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx }} size="sm" /> : null}
          {gestion ? <ButtonLink href={p("/taches/nouveau")}><IconPlus width={16} height={16} />{t.nouvelle}</ButtonLink> : null}
        </div>}
      />
      {sp.cree === "1" ? <Banner variant="ok" className="mb-4">{t.creee}</Banner> : null}
      {!res.ok ? <Banner variant="danger" className="mb-4">{t.chargementImpossible}</Banner> : null}
      {!gardien ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard icon={<CWrench />} tone="sage" label={t.ouvertes} value={String(ouverts)} href={qs({ statut: undefined, retard: undefined })} />
          <StatCard icon={<CAlert />} tone={nbRetard > 0 ? "warn" : "sage"} label={t.enRetard} value={String(nbRetard)} href={qs({ retard: "1", statut: undefined })} />
          <StatCard icon={<CCalendar />} tone="lilac" label={e.statut.TERMINEE} value={String(parStatut.TERMINEE ?? 0)} href={qs({ statut: "TERMINEE", retard: undefined })} />
        </div>
      ) : null}
      {!gardien && vue === "liste" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <LinkTabs tabs={[{ href: qs({ statut: undefined, retard: undefined }), label: t.ouvertes, active: !statut && !retard }, { href: qs({ retard: "1", statut: undefined }), label: t.enRetard, active: retard, count: nbRetard || undefined }, ...STATUTS.map((s) => ({ href: qs({ statut: s, retard: undefined }), label: e.statut[s], active: statut === s, count: parStatut[s] }))]} />
          <div className="ms-auto flex gap-1.5 text-[12px]">
            {(["MANUELLE", "RESOLUTION_AG", "CONTRAT", "INCIDENT", "RAPPORT", "SYSTEME"] as OrigineTache[]).map((o) => <Link key={o} href={qs({ origine: origine === o ? undefined : o })} className={`rounded-full border px-2.5 py-1 ${origine === o ? "border-ink bg-ink text-white" : "border-hairline text-soft"}`}>{e.origine[o]}</Link>)}
          </div>
        </div>
      ) : null}
      {rows.length === 0 ? <EmptyState title={gardien ? t.aucuneMienne : statut || retard || origine ? t.aucuneFiltre : t.aucune} hint={gestion && !statut && !retard ? t.aucuneAide : undefined} icon={<IconTasks width={44} height={44} />} action={gestion ? <ButtonLink href={p("/taches/nouveau")}>{t.nouvelle}</ButtonLink> : undefined} /> : vue === "kanban" && !gardien ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLONNES.map((col) => {
            const items = rows.filter((x) => x.statut === col);
            return (
              <div key={col} className="rounded-card bg-ground p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold text-ink-strong">{e.statut[col]}</span><Badge variant={tacheVariant[col]}>{items.length}</Badge></div>
                <div className="space-y-2">{items.map(ligne)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <TableCard>
          <Table>
            <THead><TH>{t.titreChamp}</TH><TH>{t.origine}</TH><TH>{t.priorite}</TH><TH>{t.assignee}</TH><TH>{t.echeance}</TH><TH>{t.statut}</TH></THead>
            <tbody>
              {rows.map((x) => (
                <TR key={x.id}>
                  <TD><Link href={p(`/taches/${x.id}`)} className="font-medium text-ink-strong hover:text-action">{x.titre}</Link>{x.checklist?.length ? <span className="ms-2 text-[12px] text-soft">{fill(t.checklistProgres, { n: x.checklistFaits, total: x.checklist.length })}</span> : null}</TD>
                  <TD className="text-soft">{e.origine[x.origine]}</TD>
                  <TD><Badge variant={prioriteVariant[x.priorite]}>{e.priorite[x.priorite]}</Badge></TD>
                  <TD>{x.assignee ? nomComplet(x.assignee) ?? "—" : <span className="text-faint">{t.nonAssignee}</span>}</TD>
                  <TD className={`tnum ${x.enRetard ? "font-medium text-danger" : ""}`}>{x.dateEcheance ? formatDate(x.dateEcheance, ctx.locale) : "—"}</TD>
                  <TD><div className="flex items-center gap-1"><Badge variant={tacheVariant[x.statut]}>{e.statut[x.statut]}</Badge>{x.enRetard ? <Badge variant="danger">{t.enRetard}</Badge> : null}</div></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
