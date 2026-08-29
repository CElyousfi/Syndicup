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
import { PageHeader } from "../../../../components/page-header";
import { Card, SectionHeader } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { ButtonLink } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { StatCard } from "../../../../components/ui/stat-card";
import { Bars, Donut } from "../../../../components/ui/charts";
import { IconCircle, CBuilding, CCalendar, CCoins, CMoneyBag, CVote, CWrench } from "../../../../components/ui/color-icons";
import { agVariant, urgenceVariant } from "../../../../lib/status";
import { IconArrowEnd, IconCoins, IconKey } from "../../../../components/ui/icons";

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
    <div className="animate-fade">
      <PageHeader
        title={fill(dict.dash.greeting, { prenom })}
        subtitle={
          lectureSeule
            ? dict.dash.controleTitle
            : `${ctx.copropriete?.nom ?? ""} · ${fill(dict.lots.subtitle, {
                count: totalLots,
                tantiemes: ctx.copropriete?.totalTantiemes ?? "—",
              })}`
        }
        actions={
          lectureSeule ? undefined : (
            <>
              <ButtonLink href={p("/invitations?nouvelle=1")} variant="secondary" size="md">
                <IconKey width={16} height={16} />
                {dict.dash.inviterResident}
              </ButtonLink>
              <ButtonLink href={p("/finances/appels-de-fonds?generer=1")} variant="primary" size="md">
                <IconCoins width={16} height={16} />
                {dict.dash.genererAppel}
              </ButtonLink>
            </>
          )
        }
      />

      {/* Indicateurs clés */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash-stats">
        <StatCard
          icon={<CMoneyBag />}
          tone="sage"
          label={dict.finances.tauxPaiement}
          value={`${Math.round(tauxRecouvrement * 100)}%`}
          trendTone={tauxRecouvrement >= 0.85 ? "ok" : tauxRecouvrement >= 0.6 ? "warn" : "danger"}
          trend={<TrendArrow up={tauxRecouvrement >= 0.6} />}
          hint={dict.dash.recouvrementHint}
          href={p("/finances/appels-de-fonds")}
        />
        <StatCard
          icon={<CCoins />}
          tone="sand"
          label={dict.dash.impayes}
          value={formatMAD(versChaine(impaye), locale)}
          trendTone={impaye > 0n ? "danger" : "ok"}
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Encaissement par appel — barres */}
        <Card className="lg:col-span-2">
          <SectionHeader
            title={dict.dash.recouvrement}
            subtitle={dict.dash.recouvrementHint}
            action={
              <Link
                href={p("/finances/appels-de-fonds")}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-action hover:underline"
              >
                {dict.common.seeAll}
                <IconArrowEnd width={14} height={14} />
              </Link>
            }
          />
          {barres.length === 0 ? (
            <EmptyState
              title={dict.finances.aucunAppel}
              hint={dict.finances.aucunAppelAide}
              action={
                lectureSeule ? undefined : (
                  <ButtonLink href={p("/finances/appels-de-fonds?generer=1")} size="sm">
                    {dict.finances.genererAppel}
                  </ButtonLink>
                )
              }
              className="mt-4 border-0 shadow-none"
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
                centerLabel={formatMAD(versChaine(impaye), locale)}
                centerSub={dict.dash.impayes}
                items={[
                  {
                    label: dict.finances.tauxPaiement,
                    value: Number(paye),
                    display: formatMAD(versChaine(paye), locale),
                    color: "var(--color-sage)",
                  },
                  {
                    label: dict.dash.impayes,
                    value: Number(impaye),
                    display: formatMAD(versChaine(impaye), locale),
                    color: "var(--color-danger)",
                  },
                ]}
              />
            ) : (
              <Donut
                size={168}
                centerLabel={formatMAD(versChaine(impaye), locale)}
                centerSub={dict.dash.impayes}
                items={parNiveau.map((n) => ({
                  label: dict.enums.escalade[n.niveau],
                  value: Number(n.montant),
                  display: formatMAD(versChaine(n.montant), locale),
                }))}
              />
            )}
          </div>
        </Card>

        {/* Incidents ouverts */}
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-6 pb-3">
            <SectionHeader
              title={dict.dash.incidentsOuverts}
              subtitle={
                slaDepasses.length > 0
                  ? `${slaDepasses.length} · ${dict.dash.slaDepasse}`
                  : undefined
              }
              action={
                <Link
                  href={p("/incidents")}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-action hover:underline"
                >
                  {dict.common.seeAll}
                  <IconArrowEnd width={14} height={14} />
                </Link>
              }
            />
          </div>
          {incidents.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-soft">{dict.incidents.aucunIncident}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {incidents.slice(0, 5).map((i) => {
                const enRetard =
                  i.slaDeadline && new Date(i.slaDeadline).getTime() < Date.now();
                return (
                  <li key={i.id}>
                    <Link
                      href={p(`/incidents/${i.id}`)}
                      className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-hover"
                    >
                      <IconCircle tone={enRetard ? "danger" : "tosca"} size={40}>
                        <CWrench width={20} height={20} />
                      </IconCircle>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {i.sousCategorie}
                        </p>
                        <p className="mt-0.5 text-[12px] text-soft">
                          {dict.enums.categorieIncident[i.categorie]} ·{" "}
                          {dict.enums.partie[i.partie]}
                        </p>
                      </div>
                      {enRetard ? (
                        <Badge variant="danger" pulse>
                          {dict.incidents.slaDepasse}
                        </Badge>
                      ) : (
                        <Badge variant={urgenceVariant[i.urgence]}>
                          {dict.enums.urgence[i.urgence]}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Prochaine AG + réservations / litiges */}
        <div className="min-w-0 space-y-4">
          <Card>
            <SectionHeader title={dict.dash.prochaineAg} />
            {prochaineAg ? (
              <Link href={p(`/ag/${prochaineAg.id}`)} className="group mt-4 block">
                <div className="flex items-center gap-3.5">
                  <IconCircle tone="lilac" size={44}>
                    <CVote />
                  </IconCircle>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink group-hover:text-action">
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
              </Link>
            ) : (
              <div className="mt-4 flex items-start gap-3.5">
                <IconCircle tone="lilac" size={44}>
                  <CVote />
                </IconCircle>
                <div className="min-w-0">
                  <p className="text-sm text-soft">{dict.dash.aucuneAg}</p>
                  {!lectureSeule ? (
                    <ButtonLink href={p("/ag/nouvelle")} variant="secondary" size="sm" className="mt-3">
                      {dict.dash.creerAg}
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-3">
              <SectionHeader
                title={
                  lectureSeule ? dict.dash.litigesOuverts : dict.dash.reservationsAValider
                }
                action={
                  <Link
                    href={p(lectureSeule ? "/litiges" : "/reservations")}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-action hover:underline"
                  >
                    {dict.common.seeAll}
                    <IconArrowEnd width={14} height={14} />
                  </Link>
                }
              />
            </div>
            {lectureSeule ? (
              litigesOuverts.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-soft">{dict.litiges.aucun}</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {litigesOuverts.slice(0, 4).map((l) => (
                    <li key={l.id} className="px-6 py-3">
                      <p className="truncate text-sm font-medium text-ink">{l.type}</p>
                      <p className="mt-0.5 text-[12px] text-soft">
                        {
                          dict.enums.escaladeLitige[
                            String(l.escaladeNiveau) as "0" | "1" | "2"
                          ]
                        }
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : reservationsEnAttente.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-soft">{dict.espaces.aucuneReservation}</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {reservationsEnAttente.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={p("/reservations")}
                      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-hover"
                    >
                      <IconCircle tone="tosca" size={36}>
                        <CCalendar width={18} height={18} />
                      </IconCircle>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {formatDateHeure(r.dateDebut, locale)}
                      </p>
                      <Badge variant="warn" pulse>
                        {dict.enums.statutReservation.EN_ATTENTE}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <DocumentsCard documents={documents} dict={dict} locale={locale} />
        </div>

        {/* Détail des appels de fonds */}
        {appels.length > 0 ? (
          <Card className="lg:col-span-3" padded={false}>
            <div className="p-6 pb-3">
              <SectionHeader title={dict.finances.appels} subtitle={dict.finances.appelsSubtitle} />
            </div>
            <ul className="divide-y divide-hairline">
              {appels.slice(0, 6).map((a) => {
                const t = totaux.get(a.id) ?? { du: 0n, paye: 0n, ratio: 0 };
                return (
                  <li key={a.id}>
                    <Link
                      href={p(`/finances/appels-de-fonds/${a.id}`)}
                      className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-hover sm:gap-6"
                    >
                      <IconCircle tone="sand" size={40} className="hidden sm:inline-flex">
                        <CCoins width={20} height={20} />
                      </IconCircle>
                      <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                        <p className="truncate text-sm font-medium text-ink">
                          {formatPeriode(a.periode, locale)}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-soft">
                          {dict.enums.typeAppel[a.type]}
                        </p>
                      </div>
                      <MiniJauge ratio={t.ratio} />
                      <div className="ms-auto min-w-0 text-end">
                        <p className="tnum text-sm font-semibold text-ink">
                          {formatMAD(versChaine(t.paye), locale)}
                          <span className="font-normal text-faint">
                            {" "}
                            / {formatMAD(a.montantTotal, locale)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-soft">
                          {dict.finances.echeance} · {formatDate(a.dateEcheance, locale)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
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
    <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-ground sm:block">
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
