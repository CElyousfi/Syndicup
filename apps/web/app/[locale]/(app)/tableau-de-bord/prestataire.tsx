import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import type { AppContext } from "../../../../lib/app-context";
import type { Incident } from "../../../../lib/api/types";
import { fill } from "../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { IconCircle, CAlert, CWrench } from "../../../../components/ui/color-icons";
import { incidentVariant, urgenceVariant } from "../../../../lib/status";

/** Vue minimale : le prestataire ne voit QUE ses tickets assignés (Doc A §12.3). */
export async function DashboardPrestataire({ ctx }: { ctx: AppContext }) {
  const { dict, locale } = ctx;
  const incidentsRes = await apiFetch<Incident[]>("/incidents", { searchParams: { limit: 50 } });
  const tickets = incidentsRes.ok ? incidentsRes.data : [];
  const ouverts = tickets.filter((i) => i.statut === "OUVERT" || i.statut === "EN_COURS");
  const prenom = ctx.profil.prenom ?? nomComplet(ctx.profil) ?? "";

  return (
    <div className="animate-fade">
      <PageHeader
        title={fill(dict.dash.greeting, { prenom })}
        subtitle={dict.dash.mesTickets}
      />
      {tickets.length === 0 ? (
        <EmptyState title={dict.incidents.aucunIncident} hint={dict.incidents.aucunIncidentAide} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash-stats">
            <StatCard
              icon={<CWrench />}
              tone="tosca"
              label={dict.dash.mesTickets}
              value={tickets.length}
            />
            <StatCard
              icon={<CAlert />}
              tone="warn"
              label={dict.dash.incidentsOuverts}
              value={ouverts.length}
            />
          </div>

          <Card className="mt-4" padded={false}>
            <div className="p-6 pb-3">
              <SectionHeader title={dict.dash.mesTickets} />
            </div>
            <ul className="divide-y divide-hairline">
              {tickets.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/${locale}/incidents/${i.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-hover"
                  >
                    <IconCircle tone="tosca" size={40}>
                      <CWrench width={20} height={20} />
                    </IconCircle>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{i.sousCategorie}</p>
                      <p className="mt-0.5 text-[12px] text-soft">
                        {dict.enums.categorieIncident[i.categorie]} ·{" "}
                        {formatDateHeure(i.creeLe, locale)}
                      </p>
                    </div>
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <Badge variant={urgenceVariant[i.urgence]}>
                        {dict.enums.urgence[i.urgence]}
                      </Badge>
                      <Badge variant={incidentVariant[i.statut]}>
                        {dict.enums.statutIncident[i.statut]}
                      </Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
