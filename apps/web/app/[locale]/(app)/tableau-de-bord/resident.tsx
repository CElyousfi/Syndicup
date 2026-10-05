import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import type { AppContext } from "../../../../lib/app-context";
import type {
  Annonce,
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
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { PageHeader } from "../../../../components/page-header";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { StatCard } from "../../../../components/ui/stat-card";
import { incidentVariant, reservationVariant } from "../../../../lib/status";
import {
  IconBell,
  IconCalendar,
  IconChevronEnd,
  IconHome,
  IconMegaphone,
  IconVote,
  IconWrench,
} from "../../../../components/ui/icons";
import {
  IconCircle,
  CBell,
  CCalendar,
  CCoins,
  CHome,
  CWrench,
} from "../../../../components/ui/color-icons";
import { AgPoster, EmptyLine, FlatList, RoundActions, Row, RowIcon, Section, transparenceDansNav } from "./parts";
import { PosterCard } from "../../../../components/ui/poster-card";
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
  // M21 — tableau d'affichage : les dernières annonces (épinglées d'abord) et le nombre de non lues.
  const annoncesRes = await apiFetch<Annonce[]>("/annonces", { searchParams: { limit: 4 } });
  const annonces = annoncesRes.ok ? annoncesRes.data : [];
  const annoncesNonLues = annoncesRes.ok ? Number((annoncesRes.meta as { non_lues?: number }).non_lues ?? 0) : 0;
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

  // Lien transparence seulement s'il figure dans la navigation du rôle (mêmes droits que la coque).
  const transparenceHref = transparenceDansNav(ctx);

  const prenom = ctx.profil.prenom ?? nomComplet(ctx.profil) ?? "";

  return (
    <div className="page-root">
      {/* Accueil Wise : la résidence en bandeau, puis le GRAND bonjour. */}
      <PhotoBanner src={photoSrc(ctx.copropriete, "accueil")} title={ctx.copropriete?.nom} subtitle={ctx.copropriete?.adresse} className="mb-6 shadow-none!" />
      <PageHeader title={fill(dict.dash.greeting, { prenom })} reveal subtitle={ctx.copropriete?.nom ?? undefined} />

      {/* Soldes Wise : tuiles chiffres clés */}
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

      {/* Actions rondes — mêmes entrées et mêmes droits que le bouton « Actions ». */}
      <RoundActions ctx={ctx} />

      {/* Mon solde, lot par lot (blocs de solde Wise) */}
      {!locataire ? (
        <Section
          className="mt-10"
          title={dict.dash.monSolde}
          subtitle={`${dict.dash.payerEnLigne} · ${dict.dash.bientotDisponible}`}
        >
          {lotsAvecSolde.length === 0 ? (
            <EmptyLine text={dict.common.emptyDefault} icon={<IconHome width={20} height={20} />} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lotsAvecSolde.map((lot) => {
                const du = soldes.get(lot.id) ?? 0n;
                const aJour = du <= 0n;
                return (
                  <Link
                    key={lot.id}
                    href={p(`/lots/${lot.id}?onglet=finances`)}
                    className="card group block p-5 transition-colors hover:bg-hairline-strong/50"
                  >
                    <div className="flex items-center gap-3">
                      <IconCircle tone={aJour ? "sage" : "sand"} size={40}>
                        <CHome width={20} height={20} />
                      </IconCircle>
                      <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">
                        {dict.enums.typeLot[lot.typeLot]} {lot.numero}
                      </p>
                      <Badge variant={aJour ? "ok" : "danger"}>
                        {aJour ? dict.enums.statutLigne.PAYE : dict.enums.statutLigne.IMPAYE}
                      </Badge>
                    </div>
                    <p className={`tnum mt-6 truncate text-[30px] font-bold leading-none tracking-[-0.02em] ${aJour ? "text-ink" : "text-danger"}`}>
                      {formatMAD(versChaine(du), locale)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[14px] text-soft">{aJour ? dict.dash.monSoldeAJour : dict.dash.soldeDu}</p>
                      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-link">
                        {dict.dash.voirDetail}
                        <IconChevronEnd width={16} height={16} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {/* CMI volontairement inactif (D7) : emplacement présent, action désactivée. */}
          <span
            className="mt-4 inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-btn bg-wash px-4 text-[14px] font-semibold text-soft"
            title={dict.finances.cmiIndisponible}
          >
            {dict.dash.payerEnLigne}
            <Badge variant="outline">{dict.dash.bientotDisponible}</Badge>
          </span>
        </Section>
      ) : null}

      {/* Prochaine AG (pas pour le locataire) — carte-affiche */}
      {!locataire ? (
        <div className="mt-10">
          {prochaineAg ? (
            <AgPoster
              ag={prochaineAg}
              dict={dict}
              locale={locale}
              actions={
                <>
                  {prochaineAg.statut === "EN_COURS" ? (
                    <ButtonLink href={p(`/ag/${prochaineAg.id}/seance`)}>{dict.ag.rejoindreSeance}</ButtonLink>
                  ) : null}
                  {prochaineAg.statut === "CONVOQUEE" ? (
                    <ButtonLink href={p(`/ag/${prochaineAg.id}#procurations`)}>{dict.dash.donnerProcuration}</ButtonLink>
                  ) : null}
                  {/* Contour blanc : la pill secondaire verte disparaîtrait sur la salle verte. */}
                  <Link
                    href={p(`/ag/${prochaineAg.id}`)}
                    className="su-btn inline-flex h-11 items-center rounded-btn border-[1.5px] border-white/70 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    {dict.common.details}
                  </Link>
                </>
              }
            />
          ) : (
            <Section title={dict.dash.prochaineAg}>
              <EmptyLine text={dict.dash.aucuneAg} icon={<IconVote width={20} height={20} />} />
            </Section>
          )}
        </div>
      ) : null}

      {/* Sans affiche d'AG : l'affiche « Où va mon argent », si la transparence est dans la navigation du rôle. */}
      {!prochaineAg && transparenceHref ? (
        <PosterCard
          className="mt-10"
          title={dict.rapports.transparenceTitre}
          body={dict.rapports.transparenceSubtitle}
          href={transparenceHref}
          ctaLabel={dict.common.see}
          poster="poster-transparence"
        />
      ) : null}

      <div className="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Section title={dict.dash.mesIncidents} href={p("/incidents")} linkLabel={dict.common.seeAll}>
          <ListeIncidents incidents={incidents} ctx={ctx} />
        </Section>

        <Section title={dict.dash.mesReservations} href={p("/reservations")} linkLabel={dict.common.seeAll}>
          <ListeReservations reservations={reservations} ctx={ctx} />
        </Section>

        {/* M21 — Tableau d'affichage */}
        <Section
          title={dict.communication.titre}
          subtitle={annoncesNonLues > 0 ? fill(dict.communication.nonLues, { n: annoncesNonLues }) : undefined}
          href={p("/affichage")}
          linkLabel={dict.common.seeAll}
        >
          {annonces.length === 0 ? (
            <EmptyLine text={dict.communication.aucune} icon={<IconMegaphone width={20} height={20} />} />
          ) : (
            <FlatList>
              {annonces.map((a) => (
                <Row
                  key={a.id}
                  href={p(`/affichage/${a.id}`)}
                  strong={!a.lu}
                  icon={
                    <RowIcon tone={a.categorie === "URGENCE" || a.categorie === "SECURITE" ? "sand" : "sage"}>
                      <CBell />
                    </RowIcon>
                  }
                  title={a.titre}
                  subtitle={`${dict.enumsCommunication.categorieAnnonce[a.categorie]}${a.publieLe ? ` · ${formatDateHeure(a.publieLe, locale)}` : ""}`}
                  trailing={
                    !a.lu ? (
                      <Badge variant="warn">{dict.communication.nonLue}</Badge>
                    ) : a.epingle ? (
                      <Badge variant="ink">{dict.communication.epinglee}</Badge>
                    ) : null
                  }
                />
              ))}
            </FlatList>
          )}
        </Section>

        {/* Notifications récentes */}
        <Section title={dict.dash.notificationsRecentes} href={p("/notifications")} linkLabel={dict.notifs.voirToutes}>
          {notifs.length === 0 ? (
            <EmptyLine text={dict.notifs.aucune} icon={<IconBell width={20} height={20} />} />
          ) : (
            <FlatList>
              {notifs.map((n) => (
                <Row
                  key={n.id}
                  href={lienNotification(n.templateCode, n.contenuJson, locale)}
                  strong={!n.lu}
                  icon={
                    <RowIcon tone={n.lu ? "surface" : "sand"}>
                      <CBell />
                    </RowIcon>
                  }
                  title={n.rendu?.titre ?? n.templateCode}
                  subtitle={formatDateHeure(n.horodatageEnvoi, locale)}
                />
              ))}
            </FlatList>
          )}
        </Section>

        {/* Documents de la copropriété — consultables dans l'app */}
        <DocumentsCard documents={documents} dict={dict} locale={locale} className="lg:col-span-2" />
      </div>
    </div>
  );
}

function ListeIncidents({ incidents, ctx }: { incidents: Incident[]; ctx: AppContext }) {
  const { dict, locale } = ctx;
  if (incidents.length === 0)
    return <EmptyLine text={dict.incidents.aucunIncident} icon={<IconWrench width={20} height={20} />} />;
  return (
    <FlatList>
      {incidents.slice(0, 5).map((i) => (
        <Row
          key={i.id}
          href={`/${locale}/incidents/${i.id}`}
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
    return <EmptyLine text={dict.espaces.aucuneReservation} icon={<IconCalendar width={20} height={20} />} />;
  return (
    <FlatList>
      {reservations.map((r) => (
        <Row
          key={r.id}
          icon={
            <RowIcon tone="sand">
              <CCalendar />
            </RowIcon>
          }
          title={formatDateHeure(r.dateDebut, locale)}
          trailing={<Badge variant={reservationVariant[r.statut]}>{dict.enums.statutReservation[r.statut]}</Badge>}
        />
      ))}
    </FlatList>
  );
}
