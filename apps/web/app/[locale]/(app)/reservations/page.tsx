import type { Metadata } from "next";
import { getAppContext } from "../../../../lib/app-context";
import { apiFetch } from "../../../../lib/api/client";
import type { EspaceCommun, Lot, Reservation } from "../../../../lib/api/types";
import { getDict, isLocale } from "../../../../lib/i18n";
import { formatDateHeure, formatHeure, nomComplet } from "../../../../lib/format";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { SectionHeader } from "../../../../components/ui/card";
import { Ligne, Lignes, type LigneLive } from "../../../../components/espaces/ligne-liste";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { CBell, CCalendar, CHandshake } from "../../../../components/ui/color-icons";
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

  const CarteReservation = ({ r, actions, ...live }: LigneLive & { r: Reservation; actions?: React.ReactNode }) => (
    <Ligne
      {...live}
      icon={<CCalendar width={22} height={22} />}
      tone={r.statut === "EN_ATTENTE" ? "warn" : r.statut === "CONFIRMEE" ? "sage" : "tosca"}
      title={espaceParId.get(r.espaceId) ?? e.espace}
      subtitle={
        <>
          <span className="tnum">
            {formatDateHeure(r.dateDebut, ctx.locale)} → {formatHeure(r.dateFin, ctx.locale)}
          </span>
          {gestion
            ? ` · ${dict.invitations.lot} ${lotParId.get(r.lotId)?.numero ?? "—"} · ${e.demandePar} ${nomDemandeur(r)}`
            : ""}
        </>
      }
      extra={
        r.motifRejet ? (
          <p className="mt-1 text-[13px] text-danger">
            {e.motifRejet} : {r.motifRejet}
          </p>
        ) : undefined
      }
      end={
        <Badge variant={reservationVariant[r.statut]} pulse={r.statut === "EN_ATTENTE"}>
          {dict.enums.statutReservation[r.statut]}
        </Badge>
      }
      actions={actions}
    />
  );

  return (
    <div className="page-root">
      <PageHeader title={gestion ? e.reservations : e.mesReservations} />

      {gestion && reservations.length > 0 ? (
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
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
          illustration="empty-reservations"
        />
      ) : (
        <div className="space-y-10">
          {gestion && enAttente.length > 0 ? (
            <div>
              <SectionHeader title={e.fileAttente} className="mb-3" />
              <Lignes>
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
              </Lignes>
            </div>
          ) : null}

          {!gestion && enAttente.length > 0 ? (
            <Lignes>
              {enAttente.map((r) => (
                <CarteReservation
                  key={r.id}
                  r={r}
                  actions={<AnnulerModal dict={dict} locale={ctx.locale} reservationId={r.id} />}
                />
              ))}
            </Lignes>
          ) : null}

          {autres.length > 0 ? (
            <div>
              {gestion || enAttente.length > 0 ? (
                <SectionHeader title={e.planning} className="mb-3" />
              ) : null}
              <Lignes>
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
              </Lignes>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
