import Link from "next/link";
import { apiFetch } from "../../../../lib/api/client";
import {
  getLots,
  getSynthese,
  impayesParNiveau,
  totauxGlobaux,
  totauxParAppel,
} from "../../../../lib/finances-data";
import type { AppContext } from "../../../../lib/app-context";
import type {
  AssembleeGenerale,
  DocumentCopro,
  Incident,
  Litige,
  Reservation,
} from "../../../../lib/api/types";
import { DocumentsCard } from "../../../../components/documents/documents-card";
import { fill } from "../../../../lib/i18n";
import {
  formatDate,
  formatDateHeure,
  formatMAD,
  formatPeriode,
  joursRestants,
  nomComplet,
} from "../../../../lib/format";
import { versCentimes, versChaine } from "../../../../lib/centimes";
import { photoSrc } from "../../../../lib/photos";
import { PhotoBanner } from "../../../../components/ui/photo-banner";
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { Banner } from "../../../../components/ui/banner";
import { Bars, Donut } from "../../../../components/ui/charts";
import { CBuilding, CCalendar, CCoins, CMoneyBag, CScale, CWrench } from "../../../../components/ui/color-icons";
import { urgenceVariant } from "../../../../lib/status";
import { chargerOnboarding } from "../import/onboarding-card";
import { IconCalendar, IconScale, IconVote, IconWrench } from "../../../../components/ui/icons";
import { AgPoster, ChecklistTile, EmptyLine, FlatList, RoundActions, Row, RowIcon, Section } from "./parts";
import { Amount } from "../../../../components/ui/amount";

export async function DashboardSyndic({
  ctx,
  lectureSeule,
}: {
  ctx: AppContext;
  lectureSeule: boolean;
}) {
  const { dict, locale } = ctx;
  const p = (path: string) => `/${locale}${path}`;

  const [synthese, incidentsRes, agsRes, reservationsRes, lots, litigesRes, documentsRes] =
    await Promise.all([
      getSynthese(),
      apiFetch<Incident[]>("/incidents", { searchParams: { limit: 100 } }),
      apiFetch<AssembleeGenerale[]>("/ag", { searchParams: { limit: 10 } }),
      apiFetch<Reservation[]>("/reservations"),
      getLots(),
      apiFetch<Litige[]>("/litiges"),
      apiFetch<DocumentCopro[]>("/documents"),
    ]);
  const documents = documentsRes.ok ? documentsRes.data : [];
  // M22 — tâches ouvertes / en retard (syndic + conseil).
  const tachesRes = await apiFetch<unknown[]>("/taches", { searchParams: { ouvertes: "1", limit: 1 } });
  // M24 — checklist de démarrage : affichée tant que tout n'est pas en place (syndic + conseil).
  const onboarding = ctx.coproprieteId ? await chargerOnboarding(ctx.coproprieteId) : null;
  const tachesMeta = tachesRes.ok ? (tachesRes.meta as { total?: number; retard?: number }) : {};
  const tachesRetard = tachesMeta.retard ?? 0;

  const appels = synthese.appels;
  const totaux = totauxParAppel(synthese);
  const { paye, impaye, taux: tauxRecouvrement } = totauxGlobaux(synthese);
  const parNiveau = impayesParNiveau(synthese);

  const incidents = (incidentsRes.ok ? incidentsRes.data : []).filter(
    (i) => i.statut === "OUVERT" || i.statut === "EN_COURS"
  );
  const slaDepasses = incidents.filter(
    (i) => i.slaDeadline && new Date(i.slaDeadline).getTime() < Date.now()
  );

  const ags = agsRes.ok ? agsRes.data : [];
  const prochaineAg =
    ags
      .filter((a) => ["PLANIFIEE", "CONVOQUEE", "EN_COURS"].includes(a.statut))
      .sort((a, b) => a.dateAg.localeCompare(b.dateAg))[0] ?? null;

  const reservationsEnAttente = (reservationsRes.ok ? reservationsRes.data : []).filter(
    (r) => r.statut === "EN_ATTENTE"
  );
  const litigesOuverts = (litigesRes.ok ? litigesRes.data : []).filter(
    (l) => l.statut === "OUVERT"
  );
  const totalLots = lots.length;

  const prenom = ctx.profil.prenom ?? nomComplet(ctx.profil) ?? "";

  // Barres « appelé / encaissé » : un appel = une barre, la plus récente est active.
  // Hauteurs relatives au plus gros appel — l'axe porte les vraies valeurs.
  const appelsBarres = appels.slice(0, 7);
  const maxAppel = appelsBarres.reduce((m, a) => {
    const c = versCentimes(a.montantTotal);
    return c > m ? c : m;
  }, 0n);
  const barres = appelsBarres
    .map((a, i) => {
      const t = totaux.get(a.id) ?? { du: 0n, paye: 0n, ratio: 0 };
      const totalC = versCentimes(a.montantTotal);
      return {
        label: formatPeriode(a.periode, locale),
        totalRatio: maxAppel > 0n ? Number(totalC) / Number(maxAppel) : 0,
        paidRatio: t.ratio,
        displayPaid: formatMAD(versChaine(t.paye), locale),
        displayTotal: formatMAD(a.montantTotal, locale),
        active: i === 0,
      };
    })
    .reverse();

  return (
    <div className="page-root">
      {/* Accueil Wise : la résidence en bandeau, puis le GRAND bonjour. */}
      <PhotoBanner src={photoSrc(ctx.copropriete, "accueil")} title={ctx.copropriete?.nom} subtitle={ctx.copropriete?.adresse} className="mb-6 shadow-none!" />
      <PageHeader
        title={fill(dict.dash.greeting, { prenom })}
        reveal
        subtitle={
          lectureSeule
            ? dict.dash.controleTitle
            : `${ctx.copropriete?.nom ?? ""} · ${fill(dict.lots.subtitle, {
                count: totalLots,
                tantiemes: ctx.copropriete?.totalTantiemes ?? "—",
              })}`
        }
      />

      {tachesRetard > 0 ? (
        <Banner
          variant="warn"
          className="mb-5"
          action={
            <Link href={p("/taches?retard=1")} className="link text-[13px]">
              {dict.taches.titre}
            </Link>
          }
        >
          {fill(dict.taches.retardN, { n: tachesRetard })}
        </Banner>
      ) : null}

      {/* M24 — checklist de démarrage, tant que tout n'est pas en place. */}
      {onboarding && !onboarding.complet ? (
        <div className="mb-5">
          <ChecklistTile checklist={onboarding} dict={dict} locale={locale} />
        </div>
      ) : null}

      {/* Soldes Wise : tuiles chiffres clés */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash-stats">
        <StatCard
          icon={<CCoins />}
          tone="sand"
          label={dict.dash.impayes}
          value={formatMAD(versChaine(impaye), locale)}
          href={p("/finances/appels-de-fonds")}
        />
        <StatCard
          icon={<CMoneyBag />}
          tone="sage"
          label={dict.finances.tauxPaiement}
          value={`${Math.round(tauxRecouvrement * 100)}%`}
          trendTone={tauxRecouvrement >= 0.85 ? "ok" : tauxRecouvrement >= 0.6 ? "warn" : "danger"}
          trend={<TrendArrow up={tauxRecouvrement >= 0.6} />}
          href={p("/finances/appels-de-fonds")}
        />
        <StatCard
          icon={<CWrench />}
          tone="tosca"
          label={dict.dash.incidentsOuverts}
          value={incidents.length}
          trend={slaDepasses.length > 0 ? `${slaDepasses.length} · ${dict.dash.slaDepasse}` : undefined}
          trendTone="danger"
          href={p("/incidents")}
        />
        <StatCard
          icon={<CBuilding />}
          tone="lilac"
          label={dict.nav.lots}
          value={totalLots}
          href={p("/lots")}
        />
      </div>

      {/* Actions rondes — mêmes entrées et mêmes droits que le bouton « Actions ». */}
      {lectureSeule ? null : <RoundActions ctx={ctx} />}

      {/* Prochaine AG : LE fait marquant, en carte-affiche. */}
      <div className="mt-10">
        {prochaineAg ? (
          <AgPoster
            ag={prochaineAg}
            dict={dict}
            locale={locale}
            href={p(`/ag/${prochaineAg.id}`)}
            ctaLabel={dict.common.details}
          />
        ) : (
          <Section title={dict.dash.prochaineAg}>
            <EmptyLine
              text={dict.dash.aucuneAg}
              icon={<IconVote width={20} height={20} />}
              action={
                lectureSeule ? undefined : (
                  <ButtonLink href={p("/ag/nouvelle")} variant="secondary" size="sm">
                    {dict.dash.creerAg}
                  </ButtonLink>
                )
              }
            />
          </Section>
        )}
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-10 lg:grid-cols-3">
        {/* Encaissement par appel — barres */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={dict.dash.recouvrement}
            subtitle={dict.dash.recouvrementHint}
            action={
              <Link href={p("/finances/appels-de-fonds")} className="link text-[14px]">
                {dict.common.seeAll}
              </Link>
            }
          />
          {barres.length === 0 ? (
            <EmptyState
              title={dict.finances.aucunAppel}
              hint={dict.finances.aucunAppelAide}
              illustration="empty-appels"
              action={
                lectureSeule ? undefined : (
                  <ButtonLink href={p("/finances/appels-de-fonds?generer=1")} size="sm">
                    {dict.finances.genererAppel}
                  </ButtonLink>
                )
              }
              className="mt-2"
            />
          ) : (
            <Bars
              items={barres}
              height={210}
              className="mt-8"
              yTop={formatMAD(versChaine(maxAppel), locale)}
              yMid={formatMAD(versChaine(maxAppel / 2n), locale)}
              legendPaid={dict.finances.tauxPaiement}
              legendTotal={dict.finances.montantTotal}
            />
          )}
        </Card>

        {/* Impayés — anneau : par niveau de relance si l'info existe, sinon encaissé/impayé. */}
        <Card>
          <SectionHeader
            title={parNiveau.length > 0 ? dict.dash.impayesParNiveau : dict.dash.impayes}
          />
          <div className="mt-6">
            {parNiveau.length === 0 ? (
              <Donut
                size={168}
                centerLabel={<Amount value={versChaine(impaye)} locale={locale} upIsGood={false} />}
                centerSub={dict.dash.impayes}
                items={[
                  {
                    label: dict.finances.tauxPaiement,
                    value: Number(paye),
                    display: <Amount value={versChaine(paye)} locale={locale} />,
                    color: "var(--color-sage)",
                  },
                  {
                    label: dict.dash.impayes,
                    value: Number(impaye),
                    display: <Amount value={versChaine(impaye)} locale={locale} upIsGood={false} />,
                    color: "var(--color-danger)",
                  },
                ]}
              />
            ) : (
              <Donut
                size={168}
                centerLabel={<Amount value={versChaine(impaye)} locale={locale} upIsGood={false} />}
                centerSub={dict.dash.impayes}
                items={parNiveau.map((n) => ({
                  label: dict.enums.escalade[n.niveau],
                  value: Number(n.montant),
                  display: <Amount value={versChaine(n.montant)} locale={locale} upIsGood={false} />,
                }))}
              />
            )}
          </div>
        </Card>

        {/* Incidents ouverts — liste à plat */}
        <Section
          className="lg:col-span-2"
          title={dict.dash.incidentsOuverts}
          subtitle={slaDepasses.length > 0 ? `${slaDepasses.length} · ${dict.dash.slaDepasse}` : undefined}
          href={p("/incidents")}
          linkLabel={dict.common.seeAll}
        >
          {incidents.length === 0 ? (
            <EmptyLine text={dict.incidents.aucunIncident} icon={<IconWrench width={20} height={20} />} />
          ) : (
            <FlatList>
              {incidents.slice(0, 5).map((i) => {
                const enRetard = i.slaDeadline && new Date(i.slaDeadline).getTime() < Date.now();
                return (
                  <Row
                    key={i.id}
                    href={p(`/incidents/${i.id}`)}
                    icon={
                      <RowIcon tone={enRetard ? "danger" : "tosca"}>
                        <CWrench />
                      </RowIcon>
                    }
                    title={i.sousCategorie}
                    subtitle={`${dict.enums.categorieIncident[i.categorie]} · ${dict.enums.partie[i.partie]}`}
                    trailing={
                      enRetard ? (
                        <Badge variant="danger" pulse>
                          {dict.incidents.slaDepasse}
                        </Badge>
                      ) : (
                        <Badge variant={urgenceVariant[i.urgence]}>{dict.enums.urgence[i.urgence]}</Badge>
                      )
                    }
                  />
                );
              })}
            </FlatList>
          )}
        </Section>

        {/* Réservations à valider (syndic) / litiges ouverts (conseil) */}
        <Section
          title={lectureSeule ? dict.dash.litigesOuverts : dict.dash.reservationsAValider}
          href={p(lectureSeule ? "/litiges" : "/reservations")}
          linkLabel={dict.common.seeAll}
        >
          {lectureSeule ? (
            litigesOuverts.length === 0 ? (
              <EmptyLine text={dict.litiges.aucun} icon={<IconScale width={20} height={20} />} />
            ) : (
              <FlatList>
                {litigesOuverts.slice(0, 4).map((l) => (
                  <Row
                    key={l.id}
                    icon={
                      <RowIcon tone="lilac">
                        <CScale />
                      </RowIcon>
                    }
                    title={l.type}
                    subtitle={dict.enums.escaladeLitige[String(l.escaladeNiveau) as "0" | "1" | "2"]}
                  />
                ))}
              </FlatList>
            )
          ) : reservationsEnAttente.length === 0 ? (
            <EmptyLine text={dict.espaces.aucuneReservation} icon={<IconCalendar width={20} height={20} />} />
          ) : (
            <FlatList>
              {reservationsEnAttente.slice(0, 4).map((r) => (
                <Row
                  key={r.id}
                  href={p("/reservations")}
                  icon={
                    <RowIcon tone="tosca">
                      <CCalendar />
                    </RowIcon>
                  }
                  title={formatDateHeure(r.dateDebut, locale)}
                  trailing={
                    <Badge variant="warn" pulse>
                      {dict.enums.statutReservation.EN_ATTENTE}
                    </Badge>
                  }
                />
              ))}
            </FlatList>
          )}
        </Section>

        {/* Appels de fonds — liste à plat, jauge d'encaissement */}
        {appels.length > 0 ? (
          <Section
            className="lg:col-span-2"
            title={dict.finances.appels}
            subtitle={dict.finances.appelsSubtitle}
            href={p("/finances/appels-de-fonds")}
            linkLabel={dict.common.seeAll}
          >
            <FlatList>
              {appels.slice(0, 6).map((a) => {
                const t = totaux.get(a.id) ?? { du: 0n, paye: 0n, ratio: 0 };
                return (
                  <Row
                    key={a.id}
                    href={p(`/finances/appels-de-fonds/${a.id}`)}
                    icon={
                      <RowIcon tone="sand">
                        <CCoins />
                      </RowIcon>
                    }
                    title={formatPeriode(a.periode, locale)}
                    subtitle={`${dict.enums.typeAppel[a.type]} · ${dict.finances.echeance} ${formatDate(a.dateEcheance, locale)}`}
                    trailing={
                      <div className="w-32 sm:w-60">
                        <p className="tnum truncate text-[14px] font-bold text-ink">
                          <Amount value={versChaine(t.paye)} locale={locale} />
                          <span className="hidden font-normal text-soft sm:inline"> / <Amount value={a.montantTotal} locale={locale} /></span>
                        </p>
                        <MiniJauge ratio={t.ratio} />
                      </div>
                    }
                  />
                );
              })}
            </FlatList>
          </Section>
        ) : null}

        <div className={`min-w-0 ${appels.length > 0 ? "" : "lg:col-span-3"}`}>
          <DocumentsCard documents={documents} dict={dict} locale={locale} />
        </div>
      </div>
    </div>
  );
}

function TrendArrow({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <path d="M2 9.5 6.5 5l3.5 3.5M6.5 5v0" /> : <path d="M2 5 6.5 9.5 10 6" />}
    </svg>
  );
}

function MiniJauge({ ratio: r }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, r)) * 100;
  const tone = r >= 1 ? "bg-ok" : r >= 0.6 ? "bg-action" : "bg-warn";
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wash">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EcheanceRelative({
  iso,
  dict,
}: {
  iso: string;
  dict: AppContext["dict"];
}) {
  const jours = joursRestants(iso);
  const texte =
    jours === 0
      ? dict.ag.aujourdhui
      : jours === 1
        ? dict.ag.demain
        : jours > 1
          ? fill(dict.ag.dansJours, { n: jours })
          : null;
  if (!texte) return null;
  return <span className="text-[12px] font-medium text-soft">{texte}</span>;
}
