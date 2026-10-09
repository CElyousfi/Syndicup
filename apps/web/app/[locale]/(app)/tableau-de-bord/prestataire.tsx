import { apiFetch } from "../../../../lib/api/client";
import type { AppContext } from "../../../../lib/app-context";
import type { Incident } from "../../../../lib/api/types";
import { fill } from "../../../../lib/i18n";
import { formatDateHeure, nomComplet } from "../../../../lib/format";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { Greeting } from "../../../../components/ui/greeting";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { CAlert, CWrench } from "../../../../components/ui/color-icons";
import { FlatList, Row, RowIcon, Section } from "./parts";
import { incidentVariant, urgenceVariant } from "../../../../lib/status";

/** Vue minimale : le prestataire ne voit QUE ses tickets assignés (Doc A §12.3). */
export async function DashboardPrestataire({ ctx }: { ctx: AppContext }) {
  const { dict, locale } = ctx;
  const incidentsRes = await apiFetch<Incident[]>("/incidents", { searchParams: { limit: 50 } });
  const tickets = incidentsRes.ok ? incidentsRes.data : [];
  const ouverts = tickets.filter((i) => i.statut === "OUVERT" || i.statut === "EN_COURS");
  const prenom = ctx.profil.prenom ?? nomComplet(ctx.profil) ?? "";

  return (
    <div className="page-root">
      <PhotoBanner src={photoSrc(ctx.copropriete, "cour")} title={ctx.copropriete?.nom} subtitle={dict.roles[ctx.role]} className="mb-6 shadow-none!" />
      <PageHeader title={<Greeting labels={dict.alive} name={prenom} fallback={fill(dict.dash.greeting, { prenom })} />} subtitle={dict.dash.mesTickets} />

      {tickets.length === 0 ? (
        <EmptyState
          title={dict.incidents.aucunIncident}
          hint={dict.incidents.aucunIncidentAide}
          illustration="empty-incidents"
        />
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

          {/* Tickets — liste à plat */}
          <Section className="mt-10" title={dict.dash.mesTickets}>
            <FlatList>
              {tickets.map((i) => (
                <Row
                  key={i.id}
                  href={`/${locale}/incidents/${i.id}`}
                  icon={
                    <RowIcon tone="tosca">
                      <CWrench />
                    </RowIcon>
                  }
                  title={i.sousCategorie}
                  subtitle={`${dict.enums.categorieIncident[i.categorie]} · ${formatDateHeure(i.creeLe, locale)}`}
                  trailing={
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      <Badge variant={urgenceVariant[i.urgence]} className="hidden sm:inline-flex">
                        {dict.enums.urgence[i.urgence]}
                      </Badge>
                      <Badge variant={incidentVariant[i.statut]}>{dict.enums.statutIncident[i.statut]}</Badge>
                    </span>
                  }
                />
              ))}
            </FlatList>
          </Section>
        </>
      )}
    </div>
  );
}
