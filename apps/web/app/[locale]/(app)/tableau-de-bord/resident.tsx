import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import type { AppContext } from "../../../../lib/app-context";
import type {
  AssembleeGenerale,
  DocumentCopro,
  Incident,
  Lot,
  Notification,
  Reservation,
} from "../../../../lib/api/types";
import { DocumentsCard } from "../../../../components/documents/documents-card";
import { fill } from "../../../../lib/i18n";
import { lienNotification } from "../../../../lib/notifications-link";
import { formatDateHeure, formatMAD, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { StatCard } from "../../../../components/ui/stat-card";
import { agVariant, incidentVariant, reservationVariant } from "../../../../lib/status";
import { IconArrowEnd, IconWrench } from "../../../../components/ui/icons";
import {
  IconCircle,
  CBell,
  CCalendar,
  CCoins,
  CHome,
  CVote,
  CWrench,
} from "../../../../components/ui/color-icons";
import { EcheanceRelative } from "./syndic";
import { versChaine } from "../../../../lib/centimes";
import { getSynthese, soldeParLot } from "../../../../lib/finances-data";

export async function DashboardResident({
  ctx,
  locataire,
}: {
  ctx: AppContext;
  locataire: boolean;
}) {
  const { dict, locale } = ctx;
  const p = (path: string) => `/${locale}${path}`;

  const [lotsRes, agsRes, incidentsRes, reservationsRes, notifsRes, documentsRes] =
    await Promise.all([
      apiFetch<Lot[]>("/lots", { searchParams: { limit: 50 } }),
      locataire
        ? Promise.resolve(null)
        : apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { limit: 10 } }),
      apiFetch<Incident[]>("/incidents", { searchParams: { limit: 20 } }),
      apiFetch<Reservation[]>("/reservations"),
      apiFetch<Notification[]>("/notifications"),
      apiFetch<DocumentCopro[]>("/documents"),
    ]);
  const documents = documentsRes.ok ? documentsRes.data : [];

  const lots = lotsRes.ok ? lotsRes.data : [];
  // Soldes en un appel — la RLS de la synthèse limite les lignes aux lots de l'appelant.
  const soldes = locataire ? new Map<string, bigint>() : soldeParLot(await getSynthese());
  const lotsAvecSolde = locataire ? [] : lots;

  const prochaineAg = agsRes?.ok
    ? (agsRes.data
        .filter((a) => ["PLANIFIEE", "CONVOQUEE", "EN_COURS"].includes(a.statut))
        .sort((a, b) => a.dateAg.localeCompare(b.dateAg))[0] ?? null)
    : null;

  const incidents = (incidentsRes.ok ? incidentsRes.data : []).filter(
    (i) => i.statut === "OUVERT" || i.statut === "EN_COURS"
  );
  const reservations = (reservationsRes.ok ? reservationsRes.data : [])
    .filter((r) => r.statut === "EN_ATTENTE" || r.statut === "CONFIRMEE")
    .slice(0, 5);
  const notifs = (notifsRes.ok ? notifsRes.data : []).slice(0, 5);

  // Indicateurs personnels — parité avec les autres tableaux de bord (syndic/gardien).
  const totalDu = lotsAvecSolde.reduce((s, lot) => s + (soldes.get(lot.id) ?? 0n), 0n);

  const prenom = ctx.profil.prenom ?? nomComplet(ctx.profil) ?? "";

  return (
    <div className="animate-fade">
      <PageHeader
        title={fill(dict.dash.greeting, { prenom })}
        subtitle={ctx.copropriete?.nom ?? undefined}
        actions={
          <ButtonLink href={p("/incidents/nouveau")} variant="secondary">
            <IconWrench width={16} height={16} />
            {dict.dash.signalerIncident}
          </ButtonLink>
        }
      />

      {/* Indicateurs personnels */}
      <div
        className={`grid gap-4 sm:grid-cols-2 ${locataire ? "" : "xl:grid-cols-3"}`}
        data-tour="dash-stats"
      >
        {!locataire ? (
          <StatCard
            icon={<CCoins />}
            tone={totalDu > 0n ? "sand" : "sage"}
            label={dict.dash.monSolde}
            value={formatMAD(versChaine(totalDu), locale)}
            trend={totalDu <= 0n ? dict.enums.statutLigne.PAYE : undefined}
            trendTone="ok"
            href={p("/lots")}
          />
        ) : null}
        <StatCard
          icon={<CWrench />}
          tone="tosca"
          label={dict.incidents.mesSignalements}
          value={incidents.length}
          href={p("/incidents")}
        />
        <StatCard
          icon={<CCalendar />}
          tone="lilac"
          label={dict.nav.reservations}
          value={reservations.length}
          href={p("/reservations")}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Mon solde par lot */}
        {!locataire ? (
          <Card className="lg:col-span-2" padded={false}>
            <div className="p-6 pb-3">
              <SectionHeader title={dict.dash.monSolde} />
            </div>
            {lotsAvecSolde.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-soft">{dict.common.emptyDefault}</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {lotsAvecSolde.map((lot) => {
                  const du = soldes.get(lot.id) ?? 0n;
                  const aJour = du <= 0n;
                  return (
                    <li key={lot.id}>
                      <Link
                        href={p(`/lots/${lot.id}?onglet=finances`)}
                        className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-hover"
                      >
                        <IconCircle tone={aJour ? "sage" : "sand"} size={40}>
                          <CHome width={20} height={20} />
                        </IconCircle>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {dict.enums.typeLot[lot.typeLot]} {lot.numero}
                          </p>
                          <p className="mt-0.5 text-[12px] text-soft">
                            {aJour ? dict.dash.monSoldeAJour : dict.dash.soldeDu}
                          </p>
                        </div>
                        <div className="text-end">
                          {aJour ? (
                            <Badge variant="ok">{dict.enums.statutLigne.PAYE}</Badge>
                          ) : (
                            <p className="tnum text-lg font-semibold text-danger">
                              {formatMAD(versChaine(du), locale)}
                            </p>
                          )}
                          <span className="mt-0.5 flex items-center justify-end gap-1 text-[12px] font-medium text-action">
                            {dict.dash.voirDetail}
                            <IconArrowEnd width={12} height={12} />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-hairline px-6 py-3">
              {/* CMI volontairement inactif (D7) : emplacement présent, action désactivée. */}
              <span
                className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-btn border border-hairline bg-ground px-3.5 text-[13px] font-medium text-faint"
                title={dict.finances.cmiIndisponible}
              >
                {dict.dash.payerEnLigne}
                <Badge variant="neutral">{dict.dash.bientotDisponible}</Badge>
              </span>
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-2" padded={false}>
            <div className="p-6 pb-3">
              <SectionHeader title={dict.dash.mesIncidents} />
            </div>
            <ListeIncidents incidents={incidents} ctx={ctx} />
          </Card>
        )}

        {/* Prochaine AG (pas pour le locataire) */}
        {!locataire ? (
          <Card>
            <SectionHeader title={dict.dash.prochaineAg} />
            {prochaineAg ? (
              <div className="mt-4">
                <div className="flex items-center gap-3.5">
                  <IconCircle tone="lilac" size={44}>
                    <CVote />
                  </IconCircle>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {dict.enums.typeAg[prochaineAg.type]}
                    </p>
                    <p className="mt-0.5 text-[13px] text-soft">
                      {formatDateHeure(prochaineAg.dateAg, locale)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge variant={agVariant[prochaineAg.statut]}>
                    {dict.enums.statutAg[prochaineAg.statut]}
                  </Badge>
                  <EcheanceRelative iso={prochaineAg.dateAg} dict={dict} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink href={p(`/ag/${prochaineAg.id}`)} variant="secondary" size="sm">
                    {dict.common.details}
                  </ButtonLink>
                  {prochaineAg.statut === "CONVOQUEE" ? (
                    <ButtonLink
                      href={p(`/ag/${prochaineAg.id}#procurations`)}
                      variant="ghost"
                      size="sm"
                    >
                      {dict.dash.donnerProcuration}
                    </ButtonLink>
                  ) : null}
                  {prochaineAg.statut === "EN_COURS" ? (
                    <ButtonLink href={p(`/ag/${prochaineAg.id}/seance`)} size="sm">
                      {dict.ag.rejoindreSeance}
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3.5">
                <IconCircle tone="lilac" size={44}>
                  <CVote />
                </IconCircle>
                <p className="text-sm text-soft">{dict.dash.aucuneAg}</p>
              </div>
            )}
          </Card>
        ) : (
          <Card>
            <SectionHeader title={dict.dash.mesReservations} />
            <ListeReservations reservations={reservations} ctx={ctx} />
          </Card>
        )}

        {/* Incidents (résident) / réservations */}
        {!locataire ? (
          <>
            <Card className="lg:col-span-2" padded={false}>
              <div className="p-6 pb-3">
                <SectionHeader
                  title={dict.dash.mesIncidents}
                  action={
                    <Link
                      href={p("/incidents")}
                      className="text-[13px] font-medium text-action hover:underline"
                    >
                      {dict.common.seeAll}
                    </Link>
                  }
                />
              </div>
              <ListeIncidents incidents={incidents} ctx={ctx} />
            </Card>
            <Card>
              <SectionHeader title={dict.dash.mesReservations} />
              <ListeReservations reservations={reservations} ctx={ctx} />
            </Card>
          </>
        ) : null}

        {/* Notifications récentes */}
        <Card className="lg:col-span-3" padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader
              title={dict.dash.notificationsRecentes}
              action={
                <Link
                  href={p("/notifications")}
                  className="text-[13px] font-medium text-action hover:underline"
                >
                  {dict.notifs.voirToutes}
                </Link>
              }
            />
          </div>
          {notifs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-soft">{dict.notifs.aucune}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {notifs.map((n) => (
                <li key={n.id}>
                  <Link
                    href={lienNotification(n.templateCode, n.contenuJson, locale)}
                    className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-hover"
                  >
                    <IconCircle tone={n.lu ? "surface" : "sand"} size={36}>
                      <CBell width={18} height={18} />
                    </IconCircle>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${n.lu ? "text-body" : "font-medium text-ink"}`}>
                        {n.rendu?.titre ?? n.templateCode}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-faint">
                      {formatDateHeure(n.horodatageEnvoi, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Documents de la copropriété — consultables dans l'app */}
        <DocumentsCard
          documents={documents}
          dict={dict}
          locale={locale}
          className="lg:col-span-3"
        />
      </div>
    </div>
  );
}

function ListeIncidents({ incidents, ctx }: { incidents: Incident[]; ctx: AppContext }) {
  const { dict, locale } = ctx;
  if (incidents.length === 0)
    return <p className="px-6 pb-6 text-sm text-soft">{dict.incidents.aucunIncident}</p>;
  return (
    <ul className="divide-y divide-hairline">
      {incidents.slice(0, 5).map((i) => (
        <li key={i.id}>
          <Link
            href={`/${locale}/incidents/${i.id}`}
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
            <Badge variant={incidentVariant[i.statut]}>{dict.enums.statutIncident[i.statut]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ListeReservations({
  reservations,
  ctx,
}: {
  reservations: Reservation[];
  ctx: AppContext;
}) {
  const { dict, locale } = ctx;
  if (reservations.length === 0)
    return <p className="mt-4 text-sm text-soft">{dict.espaces.aucuneReservation}</p>;
  return (
    <ul className="mt-4 space-y-3">
      {reservations.map((r) => (
        <li key={r.id} className="flex items-center gap-3">
          <IconCircle tone="sand" size={36}>
            <CCalendar width={18} height={18} />
          </IconCircle>
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
            {formatDateHeure(r.dateDebut, locale)}
          </p>
          <Badge variant={reservationVariant[r.statut]}>
            {dict.enums.statutReservation[r.statut]}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
