import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppContext, exigerRole } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import type { PrestataireFiche } from "../../../../../lib/api/types";
import { getDict, isLocale, fill } from "../../../../../lib/i18n";
import { formatDate, formatDateHeure, formatMAD, formatTelephone } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { LinkTabs } from "../../../../../components/ui/link-tabs";
import { StatCard } from "../../../../../components/ui/stat-card";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../../components/ui/table";
import { CCoins, CHandshake, CWrench, IconCircle } from "../../../../../components/ui/color-icons";
import { depenseVariant, incidentVariant } from "../../../../../lib/status";
import { ModifierPrestataireModal } from "../prestataire-modal";
import { RibButton } from "./rib-button";
import { Amount } from "../../../../../components/ui/amount";
import { LiveList } from "../../../../../components/ui/live-list";

type Onglet = "identite" | "interventions" | "depenses" | "evaluations";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").depenses.ficheFournisseur };
}

function Etoiles({ note }: { note: number }) {
  return (
    <span className="tnum text-warn" aria-label={`${note}/5`}>
      {"★".repeat(note)}
      <span className="text-hairline-strong">{"★".repeat(5 - note)}</span>
    </span>
  );
}

export default async function PrestataireDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  exigerRole(ctx, ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"]);
  const { dict } = ctx;
  const d = dict.depenses;
  const i = dict.incidents;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const p = (path: string) => `/${locale}${path}`;

  const res = await apiFetch<PrestataireFiche>(`/prestataires/${id}`);
  if (!res.ok) notFound();
  const x = res.data;

  const onglets: Onglet[] = x.depenses ? ["identite", "interventions", "depenses", "evaluations"] : ["identite", "interventions", "evaluations"];
  const ongletActif: Onglet = onglets.includes(sp.onglet as Onglet) ? (sp.onglet as Onglet) : "identite";
  const tabHref = (o: Onglet) => p(`/prestataires/${id}?onglet=${o}`);
  const note = x.noteMoyenne ? Number(x.noteMoyenne) : null;

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={p("/prestataires")} label={dict.nav.prestataires} />}
        title={x.nom}
        badge={<Badge variant={x.actif ? "ok" : "outline"}>{x.actif ? i.actif : i.inactif}</Badge>}
        subtitle={
          <>
            {x.specialite}
            {note !== null ? (
              <>
                {" · "}
                <Etoiles note={Math.round(note)} /> <span className="tnum">{note.toFixed(1)}</span>
              </>
            ) : (
              ` · ${d.aucuneNote}`
            )}
          </>
        }
        actions={gestion ? <ModifierPrestataireModal dict={dict} locale={ctx.locale} prestataire={x} size="md" /> : undefined}
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={<CWrench />} tone="tosca" label={d.interventions} value={String(x.nb_interventions)} />
        <StatCard icon={<CHandshake />} tone="sand" label={d.noteMoyenne} value={note !== null ? `${note.toFixed(1)} / 5` : "—"} hint={fill("{n}", { n: x.evaluations.length })} />
        {x.depenses ? (
          <StatCard icon={<CCoins />} tone="sage" label={d.totalPaye} value={formatMAD(x.depenses.total_paye, ctx.locale)} hint={`${d.totalEngage} : ${formatMAD(x.depenses.total_engage, ctx.locale)}`} />
        ) : null}
      </div>

      <LinkTabs className="mb-6" tabs={onglets.map((o) => ({ href: tabHref(o), label: d.onglets[o], active: o === ongletActif }))} />

      {ongletActif === "identite" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionHeader title={d.ficheFournisseur} />
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-soft">{d.telephone}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink" dir="ltr">{x.telephone ? <a href={`tel:${x.telephone}`} className="link">{formatTelephone(x.telephone)}</a> : x.contact || dict.common.none}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-soft">{d.email}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink" dir="ltr">{x.email ? <a href={`mailto:${x.email}`} className="link">{x.email}</a> : dict.common.none}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-soft">{d.ice}</dt>
                <dd className="tnum mt-0.5 text-[15px] font-semibold text-ink" dir="ltr">{x.ice ?? dict.common.none}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-soft">{d.rc}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink">{x.rc ?? dict.common.none}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[13px] text-soft">{d.adresse}</dt>
                <dd className="mt-0.5 text-[15px] font-semibold text-ink">{x.adresse ?? dict.common.none}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[13px] text-soft">{d.ribMasque}</dt>
                <dd>{gestion ? <RibButton dict={dict} locale={ctx.locale} prestataireId={x.id} ribMasque={x.ribMasque} /> : <span className="tnum mt-0.5 block text-sm text-ink" dir="ltr">{x.ribMasque ?? d.ribNonRenseigne}</span>}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <SectionHeader title={d.notes} />
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">{x.notes ?? dict.common.none}</p>
          </Card>
        </div>
      ) : null}

      {ongletActif === "interventions" ? (
        x.interventions.length === 0 ? (
          <EmptyState title={d.aucuneIntervention} illustration="empty-incidents" />
        ) : (
          <TableCard>
            <Table>
              <THead>
                <TH>{i.sousCategorie}</TH>
                <TH>{i.categorie}</TH>
                <TH>{i.urgence}</TH>
                <TH>{i.statut}</TH>
                <TH align="end">{i.creeLe.replace(" {date}", "")}</TH>
              </THead>
              <LiveList as="tbody">
                {x.interventions.map((inc) => (
                  <TR key={inc.id}>
                    <TD className="font-medium text-ink">
                      <Link href={p(`/incidents/${inc.id}`)} className="font-semibold hover:text-link">{inc.sousCategorie}</Link>
                    </TD>
                    <TD className="text-body">{dict.enums.categorieIncident[inc.categorie]}</TD>
                    <TD className="text-body">{dict.enums.urgence[inc.urgence]}</TD>
                    <TD><Badge variant={incidentVariant[inc.statut]}>{dict.enums.statutIncident[inc.statut]}</Badge></TD>
                    <TD align="end" className="tnum text-soft">{formatDate(inc.creeLe, ctx.locale)}</TD>
                  </TR>
                ))}
              </LiveList>
            </Table>
          </TableCard>
        )
      ) : null}

      {ongletActif === "depenses" && x.depenses ? (
        x.depenses.recentes.length === 0 ? (
          <EmptyState title={d.aucune} illustration="empty-documents" />
        ) : (
          <TableCard>
            <Table>
              <THead>
                <TH>{d.libelle}</TH>
                <TH>{d.categorie}</TH>
                <TH>{d.statut}</TH>
                <TH>{d.date}</TH>
                <TH align="end">{d.montantTtc}</TH>
              </THead>
              <LiveList as="tbody">
                {x.depenses.recentes.map((dep) => (
                  <TR key={dep.id}>
                    <TD className="font-medium text-ink"><Link href={p(`/finances/depenses/${dep.id}`)} className="font-semibold hover:text-link">{dep.libelle}</Link></TD>
                    <TD className="text-body">{dict.enumsDepenses.categorieDepense[dep.categorie]}</TD>
                    <TD><Badge variant={depenseVariant[dep.statut]}>{dict.enumsDepenses.statutDepense[dep.statut]}</Badge></TD>
                    <TD className="tnum text-soft">{formatDate(dep.dateDepense, ctx.locale)}</TD>
                    <TD align="end" className="tnum font-medium text-ink"><Amount value={dep.montantTtc} locale={ctx.locale} /></TD>
                  </TR>
                ))}
              </LiveList>
            </Table>
          </TableCard>
        )
      ) : null}

      {ongletActif === "evaluations" ? (
        x.evaluations.length === 0 ? (
          <EmptyState title={d.aucuneEvaluation} />
        ) : (
          <div className="divide-y divide-wash-strong">
            {x.evaluations.map((e) => (
              <div key={e.incident_id} className="flex items-start gap-3.5 py-4">
                <IconCircle tone="sand" size={44}>
                  <CHandshake />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {e.note ? <Etoiles note={e.note} /> : null}
                    <span className="tnum text-[15px] font-bold text-ink">{e.note}/5</span>
                    {e.evalue_le ? <span className="text-[12px] text-faint">{formatDateHeure(e.evalue_le, ctx.locale)}</span> : null}
                  </div>
                  {e.commentaire ? <p className="mt-1 text-sm text-body">{e.commentaire}</p> : null}
                  <Link href={p(`/incidents/${e.incident_id}`)} className="link mt-1 inline-block text-[13px]">{dict.nav.incidents}</Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
