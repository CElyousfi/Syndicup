import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { CategorieIncident, Incident, Prestataire, StatutIncident } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDateHeure } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Button, ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { Pagination } from "../../../../components/ui/pagination";
import { Select } from "../../../../components/ui/field";
import { Table, TableCard, TD, TH, THead, TR } from "../../../../components/ui/table";
import { StatCard } from "../../../../components/ui/stat-card";
import { CAlert, CShield, CWrench } from "../../../../components/ui/color-icons";
import { CategorieIcon } from "../../../../components/incidents/categorie-icon";
import { incidentVariant, urgenceVariant } from "../../../../lib/status";
import { IconChevronEnd, IconPlus } from "../../../../components/ui/icons";
import { ExportButtons } from "../../../../components/ui/export-buttons";
import { LiveList } from "../../../../components/ui/live-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.incidents };
}

export default async function IncidentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; statut?: string; urgence?: string; categorie?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const i = dict.incidents;
  const gestion = ["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL", "GARDIEN"].some((r) =>
    ctx.roles.includes(r as never)
  );
  const prestataire = ctx.role === "PRESTATAIRE";
  const peutSignaler = !prestataire;

  const page = Math.max(1, Number(sp.page) || 1);
  const [incidentsRes, prestatairesRes] = await Promise.all([
    apiFetch<Incident[]>("/incidents", { searchParams: { page, limit: 50 } }),
    gestion && ctx.role !== "GARDIEN"
      ? apiFetch<Prestataire[]>("/prestataires")
      : Promise.resolve(null),
  ]);
  const tous = incidentsRes.ok ? incidentsRes.data : [];
  const incidents = tous.filter((inc) => {
    if (sp.statut && inc.statut !== sp.statut) return false;
    if (sp.urgence && inc.urgence !== sp.urgence) return false;
    if (sp.categorie && inc.categorie !== sp.categorie) return false;
    return true;
  });
  const prestataireParId = new Map(
    (prestatairesRes?.ok ? prestatairesRes.data : []).map((p) => [p.id, p.nom])
  );

  // Indicateurs dérivés de la page déjà chargée — aucune requête supplémentaire.
  const ouverts = tous.filter((x) => x.statut === "OUVERT" || x.statut === "EN_COURS");
  const slaDepassesNb = ouverts.filter(
    (x) => x.slaDeadline && new Date(x.slaDeadline).getTime() < Date.now()
  ).length;
  const resolusNb = tous.filter((x) => x.statut === "RESOLU" || x.statut === "FERME").length;

  const p = (path: string) => `/${locale}${path}`;
  const titre = prestataire ? i.mesTickets : gestion ? i.titre : i.mesSignalements;

  return (
    <div className="page-root">
      <PageHeader
        title={titre}
        actions={
          <>
            {["SYNDIC", "SUPER_ADMIN", "CONSEIL_SYNDICAL"].some((r) => ctx.roles.includes(r as never)) ? <ExportButtons ressource="incidents" labels={{ csv: dict.rapports.exporterCsv, xlsx: dict.rapports.exporterXlsx, title: dict.rapports.exportIncidentsAide }} /> : null}
            {peutSignaler ? (
              <ButtonLink href={p("/incidents/nouveau")}>
                <IconPlus width={16} height={16} />
                {i.signaler}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {tous.length > 0 ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<CWrench />}
            tone="tosca"
            label={dict.dash.incidentsOuverts}
            value={ouverts.length}
          />
          <StatCard
            icon={<CAlert />}
            tone="danger"
            label={i.slaDepasse}
            value={slaDepassesNb}
            trendTone={slaDepassesNb > 0 ? "danger" : "ok"}
          />
          <StatCard
            icon={<CShield />}
            tone="ok"
            label={dict.enums.statutIncident.RESOLU}
            value={resolusNb}
          />
        </div>
      ) : null}

      <form className="filters mb-4 flex flex-wrap items-center gap-2" method="GET">
        <Select name="statut" defaultValue={sp.statut ?? ""} className="h-10 w-full sm:w-44">
          <option value="">
            {i.statut} · {dict.common.all}
          </option>
          {(Object.keys(dict.enums.statutIncident) as StatutIncident[]).map((s) => (
            <option key={s} value={s}>
              {dict.enums.statutIncident[s]}
            </option>
          ))}
        </Select>
        <Select name="urgence" defaultValue={sp.urgence ?? ""} className="h-10 w-full sm:w-48">
          <option value="">
            {i.urgence} · {dict.common.all}
          </option>
          {(["NORMALE", "URGENTE", "URGENCE_MAXIMALE"] as const).map((u) => (
            <option key={u} value={u}>
              {dict.enums.urgence[u]}
            </option>
          ))}
        </Select>
        <Select name="categorie" defaultValue={sp.categorie ?? ""} className="h-10 w-full sm:w-52">
          <option value="">
            {i.categorie} · {dict.common.all}
          </option>
          {(Object.keys(dict.enums.categorieIncident) as CategorieIncident[]).map((c) => (
            <option key={c} value={c}>
              {dict.enums.categorieIncident[c]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="sm" className="h-10">
          {dict.common.filter}
        </Button>
      </form>

      {incidents.length === 0 ? (
        <EmptyState
          title={i.aucunIncident}
          hint={gestion ? i.aucunIncidentAide : undefined}
          illustration={tous.length > 0 ? "empty-search" : "empty-incidents"}
          action={
            peutSignaler ? (
              <ButtonLink href={p("/incidents/nouveau")}>
                <IconPlus width={16} height={16} />
                {i.signaler}
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <TH>{i.categorie}</TH>
                <TH>{i.urgence}</TH>
                <TH>{i.statut}</TH>
                <TH>{i.sla}</TH>
                {gestion ? <TH>{i.assigneA}</TH> : null}
                <TH>{dict.documents.date}</TH>
              </THead>
              <LiveList as="tbody">
                {incidents.map((inc) => {
                  const enRetard =
                    inc.slaDeadline &&
                    !["RESOLU", "FERME"].includes(inc.statut) &&
                    new Date(inc.slaDeadline).getTime() < Date.now();
                  return (
                    <TR key={inc.id}>
                      <TD>
                        <div className="flex items-center gap-3.5">
                          <CategorieIcon categorie={inc.categorie} alerte={Boolean(enRetard)} />
                          <div className="min-w-0">
                            <Link
                              href={p(`/incidents/${inc.id}`)}
                              className="block max-w-64 truncate text-[15px] font-bold text-ink hover:text-link"
                            >
                              {inc.sousCategorie}
                            </Link>
                            <p className="mt-0.5 truncate text-[13px] text-soft">
                              {dict.enums.categorieIncident[inc.categorie]} ·{" "}
                              {dict.enums.partie[inc.partie]}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <Badge variant={urgenceVariant[inc.urgence]}>
                          {dict.enums.urgence[inc.urgence]}
                        </Badge>
                      </TD>
                      <TD>
                        <Badge variant={incidentVariant[inc.statut]}>
                          {dict.enums.statutIncident[inc.statut]}
                        </Badge>
                      </TD>
                      <TD>
                        {enRetard ? (
                          <Badge variant="danger" pulse>
                            {i.slaDepasse}
                          </Badge>
                        ) : inc.slaDeadline && !["RESOLU", "FERME"].includes(inc.statut) ? (
                          <span className="text-[13px] text-body">
                            {formatDateHeure(inc.slaDeadline, ctx.locale)}
                          </span>
                        ) : (
                          <span className="text-faint">{dict.common.none}</span>
                        )}
                      </TD>
                      {gestion ? (
                        <TD className="text-[13px] text-body">
                          {inc.assigneAId
                            ? (prestataireParId.get(inc.assigneAId) ?? "…")
                            : (
                              <span className="text-faint">{i.nonAssigne}</span>
                            )}
                        </TD>
                      ) : null}
                      <TD className="text-[13px] text-soft">
                        <span className="flex items-center justify-between gap-3">
                          <span className="tnum whitespace-nowrap">{formatDateHeure(inc.creeLe, ctx.locale)}</span>
                          <Link href={p(`/incidents/${inc.id}`)} aria-label={inc.sousCategorie} className="hidden text-link md:inline-flex">
                            <IconChevronEnd width={18} height={18} />
                          </Link>
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </LiveList>
            </Table>
          </TableCard>
          {incidentsRes.ok ? (
            <Pagination
              meta={incidentsRes.meta}
              basePath={p("/incidents")}
              searchParams={{ statut: sp.statut, urgence: sp.urgence, categorie: sp.categorie }}
              dict={dict}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
