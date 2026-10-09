/** Planning hebdomadaire du personnel (M20) — horaires, congés approuvés + remplaçants, présences. */
import type { Metadata } from "next";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { PlanningSemaine } from "../../../../../lib/api/types";
import { getDict, isLocale } from "../../../../../lib/i18n";
import { formatDate, nomComplet } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { TableCard } from "../../../../../components/ui/table";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { presenceVariant } from "../../../../../lib/status";
import { LiveList } from "../../../../../components/ui/live-list";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").personnel.planning };
}

function decaler(iso: string, jours: number) { return new Date(new Date(iso).getTime() + jours * 86_400_000).toISOString().slice(0, 10); }

export default async function PlanningPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ semaine?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const pe = dict.personnel;
  const en = dict.enumsPersonnelRh;
  const p = (path: string) => `/${ctx.locale}${path}`;
  const semaine = /^\d{4}-\d{2}-\d{2}$/.test(sp.semaine ?? "") ? sp.semaine : undefined;
  const res = await apiFetch<PlanningSemaine>("/personnel/planning", { searchParams: semaine ? { semaine } : {} });
  if (!res.ok) return <div className="page-root space-y-4"><BackLink href={p("/personnel")} label={dict.nav.personnel} /><Banner variant="danger">{pe.chargementImpossible}</Banner></div>;
  const x = res.data;
  const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return (
    <div className="page-root space-y-6">
      <PageHeader
        back={<BackLink href={p("/personnel")} label={dict.nav.personnel} />}
        title={pe.planning}
        subtitle={`${pe.planningSubtitle} ${formatDate(x.jours[0]!, ctx.locale)} → ${formatDate(x.jours[6]!, ctx.locale)}`}
        actions={<div className="flex gap-1.5"><ButtonLink href={p(`/personnel/planning?semaine=${decaler(x.semaine, -7)}`)} variant="secondary" size="sm">{pe.semainePrecedente}</ButtonLink><ButtonLink href={p("/personnel/planning")} variant="secondary" size="sm">{dict.common.today}</ButtonLink><ButtonLink href={p(`/personnel/planning?semaine=${decaler(x.semaine, 7)}`)} variant="secondary" size="sm">{pe.semaineSuivante}</ButtonLink></div>}
      />
      {x.personnels.length === 0 ? <EmptyState title={pe.aucuneFiche} illustration="empty-personnel" /> : (
        <TableCard>
          <table className="w-full min-w-[880px] text-[12.5px]">
            <thead><tr className="text-[12px] text-soft"><th className="rounded-s-[14px] bg-tile px-3 py-3 text-start font-semibold">{pe.titre}</th>{x.jours.map((j, i) => <th key={j} className={`bg-tile px-2 py-2 text-start font-semibold last:rounded-e-[14px] ${j === aujourdhui ? "text-ink" : ""}`}><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${j === aujourdhui ? "bg-cta" : ""}`}><span>{en.jour[JOURS[i]!]}</span><span className={`tnum ${j === aujourdhui ? "text-ink" : "text-faint"}`}>{j.slice(8, 10)}/{j.slice(5, 7)}</span></span></th>)}</tr></thead>
            <LiveList as="tbody">
              {x.personnels.map((pp) => {
                const nom = (pp.utilisateur ? nomComplet(pp.utilisateur) : null) ?? en.poste[pp.poste];
                return (
                  <tr key={pp.id} className="border-b border-wash-strong align-top transition-colors last:border-0 hover:bg-wash">
                    <td className="px-3 py-3"><a href={p(`/personnel/${pp.id}`)} className="text-[14px] font-bold text-ink hover:text-link">{nom}</a><p className="text-[12px] text-soft">{en.poste[pp.poste]}</p></td>
                    {pp.jours.map((j) => (
                      <td key={j.date} className="px-1.5 py-2">
                        {j.conge ? <p className="rounded-[10px] bg-tosca-tint px-2 py-1.5 text-[12px] font-semibold text-tosca-deep">{en.typeConge[j.conge.type]}{j.conge.remplacant ? <span className="block font-normal text-soft">→ {j.conge.remplacant}</span> : null}</p> : j.plages.length ? j.plages.map((pl, i) => <p key={i} className="tnum mb-1 w-fit rounded-full bg-sage-tint px-2 py-0.5 font-semibold text-brand-deep" dir="ltr">{pl.debut}–{pl.fin}</p>) : <p className="px-2 text-faint">{pe.aucunePlage}</p>}
                        {j.presence ? <Badge variant={presenceVariant[j.presence.statut]} className="mt-1">{en.statutPresence[j.presence.statut]}</Badge> : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </LiveList>
          </table>
        </TableCard>
      )}
    </div>
  );
}
