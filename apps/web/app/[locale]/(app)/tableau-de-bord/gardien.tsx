import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import type { AppContext } from "../../../../lib/app-context";
import type { DocumentCopro, Incident, Visite } from "../../../../lib/api/types";
import { DocumentsCard } from "../../../../components/documents/documents-card";
import { fill } from "../../../../lib/i18n";
import { formatHeure, nomComplet } from "../../../../lib/format";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { Greeting } from "../../../../components/ui/greeting";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { incidentVariant, visiteVariant } from "../../../../lib/status";
import { IconChevronEnd, IconDoor, IconWrench } from "../../../../components/ui/icons";
import { StatCard } from "../../../../components/ui/stat-card";
import { Avatar } from "../../../../components/ui/avatar";
import { CBell, CDoor, CWrench } from "../../../../components/ui/color-icons";
import { EmptyLine, FlatList, Row, RowIcon, Section } from "./parts";

/** B5 — orienté terrain : l'action primaire est énorme et sans détour. */
export async function DashboardGardien({ ctx }: { ctx: AppContext }) {
  const { dict, locale } = ctx;
  const p = (path: string) => `/${locale}${path}`;

  const [visitesRes, incidentsRes, documentsRes] = await Promise.all([
    apiFetch<Visite[]>("/visites"),
    apiFetch<Incident[]>("/incidents", { searchParams: { limit: 20 } }),
    apiFetch<DocumentCopro[]>("/documents"),
  ]);
  const documents = documentsRes.ok ? documentsRes.data : [];

  const visites = visitesRes.ok ? visitesRes.data : [];
  const aujourdhui = new Date().toDateString();
  const visitesDuJour = visites.filter(
    (v) => new Date(v.horodatage).toDateString() === aujourdhui
  );
  const enAttente = visites.filter((v) => v.statut === "EN_ATTENTE");
  const incidents = (incidentsRes.ok ? incidentsRes.data : []).filter(
    (i) => i.statut === "OUVERT" || i.statut === "EN_COURS"
  );

  const prenom = ctx.profil.prenom ?? nomComplet(ctx.profil) ?? "";

  return (
    <div className="page-root">
      <PhotoBanner src={photoSrc(ctx.copropriete, "entree")} title={ctx.copropriete?.nom} subtitle={dict.roles[ctx.role]} className="mb-6 shadow-none!" />
      <PageHeader title={<Greeting labels={dict.alive} name={prenom} fallback={fill(dict.dash.greeting, { prenom })} />} subtitle={ctx.copropriete?.nom ?? undefined} />

      {/* Deux gestes du quotidien, en très grand : tuile encre (geste principal) et tuile greige. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={p("/visites?enregistrer=1")}
          className="group flex items-center gap-5 rounded-[28px] bg-ink p-6 transition-transform active:scale-[0.99] sm:p-7"
        >
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-cta text-ink transition-transform group-hover:scale-105">
            <IconDoor width={30} height={30} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[20px] font-bold leading-tight text-white">
              {dict.dash.enregistrerVisiteur}
            </span>
            <span className="mt-1 block text-[14px] text-white/70">{dict.visites.titre}</span>
          </span>
          <IconChevronEnd width={22} height={22} className="shrink-0 text-lime" />
        </Link>
        <Link
          href={p("/incidents/nouveau")}
          className="card group flex items-center gap-5 p-6 transition-colors hover:bg-hairline-strong/50 sm:p-7"
        >
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sand-mid text-ink transition-transform group-hover:scale-105">
            <IconWrench width={28} height={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[20px] font-bold leading-tight text-ink">
              {dict.dash.signalerIncident}
            </span>
            <span className="mt-1 block text-[14px] text-soft">{dict.incidents.titre}</span>
          </span>
          <IconChevronEnd width={22} height={22} className="shrink-0 text-link" />
        </Link>
      </div>

      {/* Repères du jour */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-tour="dash-stats">
        <StatCard
          icon={<CDoor />}
          tone="sand"
          label={dict.visites.duJour}
          value={visitesDuJour.length}
          href={p("/visites")}
        />
        <StatCard
          icon={<CBell />}
          tone="warn"
          label={dict.dash.visitesEnAttente}
          value={enAttente.length}
          href={p("/visites")}
        />
        <StatCard
          icon={<CWrench />}
          tone="tosca"
          label={dict.dash.incidentsOuverts}
          value={incidents.length}
          href={p("/incidents")}
        />
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-2">
        {/* Visites en attente */}
        <Section title={dict.dash.visitesEnAttente} href={p("/visites")} linkLabel={dict.common.seeAll}>
          {enAttente.length === 0 ? (
            <EmptyLine text={dict.visites.aucuneVisite} icon={<IconDoor width={20} height={20} />} />
          ) : (
            <FlatList>
              {enAttente.slice(0, 6).map((v) => (
                <Row
                  key={v.id}
                  icon={<Avatar nom={v.visiteurNom} size={46} />}
                  title={v.visiteurNom}
                  subtitle={formatHeure(v.horodatage, locale)}
                  trailing={
                    <Badge variant="warn" pulse>
                      {dict.enums.statutVisite.EN_ATTENTE}
                    </Badge>
                  }
                />
              ))}
            </FlatList>
          )}
        </Section>

        {/* Visites du jour */}
        <Section title={dict.visites.duJour}>
          {visitesDuJour.length === 0 ? (
            <EmptyLine text={dict.visites.aucuneVisite} icon={<IconDoor width={20} height={20} />} />
          ) : (
            <FlatList>
              {visitesDuJour.slice(0, 6).map((v) => (
                <Row
                  key={v.id}
                  icon={<Avatar nom={v.visiteurNom} size={46} />}
                  title={v.visiteurNom}
                  subtitle={formatHeure(v.horodatage, locale)}
                  trailing={<Badge variant={visiteVariant[v.statut]}>{dict.enums.statutVisite[v.statut]}</Badge>}
                />
              ))}
            </FlatList>
          )}
        </Section>

        {/* Incidents ouverts */}
        <Section title={dict.dash.incidentsOuverts} href={p("/incidents")} linkLabel={dict.common.seeAll}>
          {incidents.length === 0 ? (
            <EmptyLine text={dict.incidents.aucunIncident} icon={<IconWrench width={20} height={20} />} />
          ) : (
            <FlatList>
              {incidents.slice(0, 6).map((i) => (
                <Row
                  key={i.id}
                  href={p(`/incidents/${i.id}`)}
                  icon={
                    <RowIcon tone="tosca">
                      <CWrench />
                    </RowIcon>
                  }
                  title={i.sousCategorie}
                  subtitle={dict.enums.categorieIncident[i.categorie]}
                  trailing={<Badge variant={incidentVariant[i.statut]}>{dict.enums.statutIncident[i.statut]}</Badge>}
                />
              ))}
            </FlatList>
          )}
        </Section>

        {/* Documents de la copropriété — consultables dans l'app (règlements, consignes…) */}
        <DocumentsCard documents={documents} dict={dict} locale={locale} />
      </div>
    </div>
  );
}
