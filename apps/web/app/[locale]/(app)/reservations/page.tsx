import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { EspaceCommun, Lot, Reservation } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDateHeure, formatHeure, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { CBell, CCalendar, CHandshake, IconCircle } from "../../../../components/ui/color-icons";
import { reservationVariant } from "../../../../lib/status";
import { AnnulerModal, RejeterModal, ValiderForm } from "./reservation-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: getDict(isLocale(locale) ? locale : "fr").nav.reservations };
}

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const e = dict.espaces;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));

  const [reservationsRes, espacesRes, lotsRes] = await Promise.all([
    apiFetch<Reservation[]>("/reservations"),
    apiFetch<EspaceCommun[]>("/espaces-communs"),
    apiFetch<Lot[]>("/lots", { searchParams: { limit: 100 } }),
  ]);
  const reservations = reservationsRes.ok ? reservationsRes.data : [];
  const espaceParId = new Map((espacesRes.ok ? espacesRes.data : []).map((x) => [x.id, x.nom]));
  const lots = lotsRes.ok ? lotsRes.data : [];
  const lotParId = new Map(lots.map((l) => [l.id, l]));

  const enAttente = reservations.filter((r) => r.statut === "EN_ATTENTE");
  const autres = reservations
    .filter((r) => r.statut !== "EN_ATTENTE")
    .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));

  const nomDemandeur = (r: Reservation): string => {
    const lot = lotParId.get(r.lotId);
    const rattache = [...(lot?.proprietaires ?? []), ...(lot?.occupants ?? [])].find(
      (x) => x.utilisateurId === r.utilisateurId
    );
    return nomComplet(rattache?.utilisateur) ?? "—";
  };

  const confirmees = autres.filter((r) => r.statut === "CONFIRMEE");

  const CarteReservation = ({ r, actions }: { r: Reservation; actions?: React.ReactNode }) => (
    <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
      <IconCircle tone={r.statut === "EN_ATTENTE" ? "warn" : "tosca"} size={40}>
        <CCalendar width={20} height={20} />
      </IconCircle>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {espaceParId.get(r.espaceId) ?? e.espace}
        </p>
        <p className="mt-0.5 text-[13px] text-soft">
          {formatDateHeure(r.dateDebut, ctx.locale)} → {formatHeure(r.dateFin, ctx.locale)}
          {gestion
            ? ` · ${dict.invitations.lot} ${lotParId.get(r.lotId)?.numero ?? "—"} · ${e.demandePar} ${nomDemandeur(r)}`
            : ""}
        </p>
        {r.motifRejet ? (
          <p className="mt-1 text-[13px] text-danger">
            {e.motifRejet} : {r.motifRejet}
          </p>
        ) : null}
      </div>
      <Badge variant={reservationVariant[r.statut]} pulse={r.statut === "EN_ATTENTE"}>
        {dict.enums.statutReservation[r.statut]}
      </Badge>
      {actions}
    </div>
  );

  return (
    <div className="animate-fade">
      <PageHeader title={gestion ? e.reservations : e.mesReservations} />

      {gestion && reservations.length > 0 ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<CCalendar />}
            tone="tosca"
            label={e.reservations}
            value={reservations.length}
          />
          <StatCard
            icon={<CBell />}
            tone="warn"
            label={dict.enums.statutReservation.EN_ATTENTE}
            value={enAttente.length}
            trendTone={enAttente.length > 0 ? "warn" : "ok"}
          />
          <StatCard
            icon={<CHandshake />}
            tone="ok"
            label={dict.enums.statutReservation.CONFIRMEE}
            value={confirmees.length}
          />
        </div>
      ) : null}

      {reservations.length === 0 ? (
        <EmptyState
          title={e.aucuneReservation}
          hint={e.aucuneReservationAide}
          icon={
            <IconCircle tone="tosca" size={64}>
              <CCalendar width={30} height={30} />
            </IconCircle>
          }
        />
      ) : (
        <div className="space-y-6">
          {gestion && enAttente.length > 0 ? (
            <div>
              <SectionHeader title={e.fileAttente} className="mb-3" />
              <Card padded={false} className="divide-y divide-hairline">
                {enAttente.map((r) => (
                  <CarteReservation
                    key={r.id}
                    r={r}
                    actions={
                      <span className="flex flex-wrap items-center gap-2">
                        <ValiderForm dict={dict} locale={ctx.locale} reservationId={r.id} />
                        <RejeterModal dict={dict} locale={ctx.locale} reservationId={r.id} />
                      </span>
                    }
                  />
                ))}
              </Card>
            </div>
          ) : null}

          {!gestion && enAttente.length > 0 ? (
            <Card padded={false} className="divide-y divide-hairline">
              {enAttente.map((r) => (
                <CarteReservation
                  key={r.id}
                  r={r}
                  actions={<AnnulerModal dict={dict} locale={ctx.locale} reservationId={r.id} />}
                />
              ))}
            </Card>
          ) : null}

          {autres.length > 0 ? (
            <div>
              {gestion || enAttente.length > 0 ? (
                <SectionHeader title={e.planning} className="mb-3" />
              ) : null}
              <Card padded={false} className="divide-y divide-hairline">
                {autres.map((r) => {
                  const annulable =
                    r.statut === "CONFIRMEE" &&
                    (gestion || r.utilisateurId === ctx.profil.id) &&
                    new Date(r.dateDebut).getTime() > Date.now();
                  return (
                    <CarteReservation
                      key={r.id}
                      r={r}
                      actions={
                        annulable ? (
                          <AnnulerModal dict={dict} locale={ctx.locale} reservationId={r.id} />
                        ) : undefined
                      }
                    />
                  );
                })}
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
