import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import type { AppContext } from "../../../../lib/app-context";
import type { DocumentCopro, Incident, Visite } from "../../../../lib/api/types";
import { DocumentsCard } from "../../../../components/documents/documents-card";
import { fill } from "../../../../lib/i18n";
import { formatHeure, nomComplet } from "../../../../lib/format";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { incidentVariant, visiteVariant } from "../../../../lib/status";
import { IconDoor, IconWrench } from "../../../../components/ui/icons";
import { StatCard } from "../../../../components/ui/stat-card";
import { Avatar } from "../../../../components/ui/avatar";
import { IconCircle, CBell, CDoor, CWrench } from "../../../../components/ui/color-icons";

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
    <div className="animate-fade">
      <PageHeader title={fill(dict.dash.greeting, { prenom })} subtitle={ctx.copropriete?.nom ?? undefined} />

      <PhotoBanner src={photoSrc(ctx.copropriete, "entree")} title={ctx.copropriete?.nom} subtitle={dict.roles[ctx.role]} className="mb-6" />

      {/* Deux gestes du quotidien, en très grand */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={p("/visites?enregistrer=1")}
          className="card group flex items-center gap-5 p-7 transition-all hover:border-action/40 hover:shadow-lift"
        >
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-action text-white transition-transform group-hover:scale-105">
            <IconDoor width={30} height={30} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-ink">
              {dict.dash.enregistrerVisiteur}
            </span>
            <span className="mt-1 block text-[13px] text-soft">{dict.visites.titre}</span>
          </span>
        </Link>
        <Link
          href={p("/incidents/nouveau")}
          className="card group flex items-center gap-5 p-7 transition-all hover:border-action/40 hover:shadow-lift"
        >
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ink text-white transition-transform group-hover:scale-105">
            <IconWrench width={28} height={28} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-ink">
              {dict.dash.signalerIncident}
            </span>
            <span className="mt-1 block text-[13px] text-soft">{dict.incidents.titre}</span>
          </span>
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Visites en attente */}
        <Card padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader
              title={dict.dash.visitesEnAttente}
              action={
                <Link href={p("/visites")} className="text-[13px] font-medium text-action hover:underline">
                  {dict.common.seeAll}
                </Link>
              }
            />
          </div>
          {enAttente.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-soft">{dict.visites.aucuneVisite}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {enAttente.slice(0, 6).map((v) => (
                <li key={v.id} className="flex items-center gap-4 px-6 py-3">
                  <Avatar nom={v.visiteurNom} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{v.visiteurNom}</p>
                    <p className="mt-0.5 text-[12px] text-soft">
                      {formatHeure(v.horodatage, locale)}
                    </p>
                  </div>
                  <Badge variant="warn" pulse>
                    {dict.enums.statutVisite.EN_ATTENTE}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Visites du jour */}
        <Card padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader title={dict.visites.duJour} />
          </div>
          {visitesDuJour.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-soft">{dict.visites.aucuneVisite}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {visitesDuJour.slice(0, 6).map((v) => (
                <li key={v.id} className="flex items-center gap-4 px-6 py-3">
                  <Avatar nom={v.visiteurNom} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{v.visiteurNom}</p>
                    <p className="mt-0.5 text-[12px] text-soft">
                      {formatHeure(v.horodatage, locale)}
                    </p>
                  </div>
                  <Badge variant={visiteVariant[v.statut]}>
                    {dict.enums.statutVisite[v.statut]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Incidents ouverts */}
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader
              title={dict.dash.incidentsOuverts}
              action={
                <Link href={p("/incidents")} className="text-[13px] font-medium text-action hover:underline">
                  {dict.common.seeAll}
                </Link>
              }
            />
          </div>
          {incidents.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-soft">{dict.incidents.aucunIncident}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {incidents.slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link
                    href={p(`/incidents/${i.id}`)}
                    className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-hover"
                  >
                    <IconCircle tone="tosca" size={40}>
                      <CWrench width={20} height={20} />
                    </IconCircle>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{i.sousCategorie}</p>
                      <p className="mt-0.5 text-[12px] text-soft">
                        {dict.enums.categorieIncident[i.categorie]}
                      </p>
                    </div>
                    <Badge variant={incidentVariant[i.statut]}>
                      {dict.enums.statutIncident[i.statut]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Documents de la copropriété — consultables dans l'app (règlements, consignes…) */}
        <DocumentsCard
          documents={documents}
          dict={dict}
          locale={locale}
          className="lg:col-span-2"
        />
      </div>
    </div>
  );
}
