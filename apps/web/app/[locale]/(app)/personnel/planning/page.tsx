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
  if (!res.ok) return <div className="space-y-4"><BackLink href={p("/personnel")} label={dict.nav.personnel} /><Banner variant="danger">{pe.chargementImpossible}</Banner></div>;
  const x = res.data;
  const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;
  return (
    <div className="space-y-5">
      <BackLink href={p("/personnel")} label={dict.nav.personnel} />
      <PageHeader
        title={pe.planning}
        subtitle={`${pe.planningSubtitle} ${formatDate(x.jours[0]!, ctx.locale)} → ${formatDate(x.jours[6]!, ctx.locale)}`}
        actions={<div className="flex gap-1.5"><ButtonLink href={p(`/personnel/planning?semaine=${decaler(x.semaine, -7)}`)} variant="secondary" size="sm">{pe.semainePrecedente}</ButtonLink><ButtonLink href={p("/personnel/planning")} variant="secondary" size="sm">{dict.common.today}</ButtonLink><ButtonLink href={p(`/personnel/planning?semaine=${decaler(x.semaine, 7)}`)} variant="secondary" size="sm">{pe.semaineSuivante}</ButtonLink></div>}
      />
      {x.personnels.length === 0 ? <EmptyState title={pe.aucuneFiche} /> : (
        <TableCard>
          <table className="w-full min-w-[880px] text-[12.5px]">
            <thead><tr className="border-b border-hairline text-start text-soft"><th className="px-3 py-2 text-start font-medium">{pe.titre}</th>{x.jours.map((j, i) => <th key={j} className="px-2 py-2 text-start font-medium"><span>{en.jour[JOURS[i]!]}</span><span className="ms-1 tnum text-faint">{j.slice(8, 10)}/{j.slice(5, 7)}</span></th>)}</tr></thead>
            <tbody>
              {x.personnels.map((pp) => {
                const nom = (pp.utilisateur ? nomComplet(pp.utilisateur) : null) ?? en.poste[pp.poste];
                return (
                  <tr key={pp.id} className="border-b border-hairline align-top last:border-0">
                    <td className="px-3 py-2"><a href={p(`/personnel/${pp.id}`)} className="font-medium text-ink-strong hover:text-action">{nom}</a><p className="text-[12px] text-soft">{en.poste[pp.poste]}</p></td>
                    {pp.jours.map((j) => (
                      <td key={j.date} className={`px-2 py-2 ${j.conge ? "bg-info-soft/40" : ""}`}>
                        {j.conge ? <p className="text-[12px] text-info">{en.typeConge[j.conge.type]}{j.conge.remplacant ? <span className="block text-faint">→ {j.conge.remplacant}</span> : null}</p> : j.plages.length ? j.plages.map((pl, i) => <p key={i} className="tnum text-ink-strong" dir="ltr">{pl.debut}–{pl.fin}</p>) : <p className="text-faint">{pe.aucunePlage}</p>}
                        {j.presence ? <Badge variant={presenceVariant[j.presence.statut]} className="mt-1">{en.statutPresence[j.presence.statut]}</Badge> : null}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}
