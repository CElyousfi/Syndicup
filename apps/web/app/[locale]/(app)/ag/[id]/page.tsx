import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../lib/membres";
import { getLots } from "../../../../../lib/finances-data";
import type {
  AgProcuration,
  AgResultatLigne,
  AssembleeGenerale,
  ExecutionResolution,
  ValeurVote,
} from "../../../../../lib/api/types";
import { fill, type Dict } from "../../../../../lib/i18n";
import { formatDate, formatEntier, formatHeure, formatPourcent } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { EmptyState } from "../../../../../components/ui/empty-state";
import { Avatar } from "../../../../../components/ui/avatar";
import { Donut } from "../../../../../components/ui/charts";
import { CVote, IconCircle } from "../../../../../components/ui/color-icons";
import { agVariant, resolutionVariant, tacheVariant } from "../../../../../lib/status";
import {
  AnnulerModal,
  ConvoquerForm,
  OuvrirForm,
  ProcurationModal,
  ResolutionModal,
  RevoquerForm,
} from "./ag-actions";
import { EcheanceRelative } from "../../tableau-de-bord/syndic";
import { IconClock, IconVote } from "../../../../../components/ui/icons";

export default async function AgDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const ctx = await getAppContext(locale);
  const { dict } = ctx;
  const gestion = ["SYNDIC", "SUPER_ADMIN"].some((r) => ctx.roles.includes(r as never));
  const votant = ["PROPRIETAIRE", "INDIVISAIRE"].some((r) => ctx.roles.includes(r as never));
  const a = dict.ag;

  const agRes = await apiFetch<AssembleeGenerale>(`/ag/${id}`);
  if (!agRes.ok) notFound();
  const ag = agRes.data;
  const resolutions = ag.resolutions ?? [];

  const [procsRes, lotsRes, membres] = await Promise.all([
    gestion || votant
      ? apiFetch<AgProcuration[]>(`/ag/${id}/procurations`)
      : Promise.resolve(null),
    getLots(),
    gestion || votant ? annuaireMembres() : Promise.resolve([]),
  ]);
  const procurations = (procsRes?.ok ? procsRes.data : []).filter((p) => !p.revoqueeLe);
  const lots = lotsRes;
  const membreParId = new Map(membres.map((m) => [m.id, m.nom]));
  const lotParId = new Map(lots.map((l) => [l.id, l.numero]));
  const mesLots = lots.filter((l) =>
    (l.proprietaires ?? []).some((p) => !p.dateFin && p.utilisateurId === ctx.profil.id)
  );

  // Résultats agrégés pour une AG clôturée.
  // M22 — suivi d'exécution des résolutions adoptées (lisible par tout membre voyant l'AG).
  const executionParResolution = new Map<string, ExecutionResolution>();
  await Promise.all(
    resolutions.filter((r) => r.resultat === "ADOPTEE").map(async (r) => {
      const ex = await apiFetch<ExecutionResolution>(`/ag/${id}/resolutions/${r.id}/execution`);
      if (ex.ok) executionParResolution.set(r.id, ex.data);
    })
  );
  const resultatsParResolution = new Map<string, AgResultatLigne[]>();
  if (ag.statut === "CLOTUREE") {
    await Promise.all(
      resolutions.map(async (r) => {
        const res = await apiFetch<AgResultatLigne[]>(`/ag/${id}/resolutions/${r.id}/resultats`);
        if (res.ok) resultatsParResolution.set(r.id, res.data);
      })
    );
  }

  const p = (path: string) => `/${locale}${path}`;
  const prochainOrdre = resolutions.length + 1;
  const peutEditer = gestion && (ag.statut === "PLANIFIEE" || ag.statut === "CONVOQUEE");

  const quorumRequis = ag.quorumRequis ? Number(ag.quorumRequis) : null;
  const quorumAtteint = ag.quorumAtteint ? Number(ag.quorumAtteint) : null;

  return (
    <div className="page-root">
      <PageHeader
        back={<BackLink href={p("/ag")} label={dict.nav.ag} />}
        title={dict.enums.typeAg[ag.type]}
        actions={
          ag.statut === "EN_COURS" ? (
            <ButtonLink href={p(`/ag/${id}/seance`)}>
              <IconVote width={16} height={16} />
              {gestion ? a.pupitre : a.rejoindreSeance}
            </ButtonLink>
          ) : ag.statut === "CLOTUREE" ? (
            <ButtonLink href={p(`/ag/${id}/pv`)} variant="secondary">
              {a.pv}
            </ButtonLink>
          ) : undefined
        }
      />

      {/* Synthèse : la date en grand, le statut, la jauge de quorum. */}
      <Card className="mb-6 p-5 sm:p-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <IconCircle tone={ag.statut === "EN_COURS" ? "warn" : "lilac"} size={48}>
                <CVote />
              </IconCircle>
              <Badge variant={agVariant[ag.statut]} pulse={ag.statut === "EN_COURS"}>
                {dict.enums.statutAg[ag.statut]}
              </Badge>
            </div>
            <p className="mt-5 text-[13px] font-medium text-soft">{a.date}</p>
            <p className="tnum mt-1 text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[44px]">
              {formatDate(ag.dateAg, ctx.locale)}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-body">
              <span className="inline-flex items-center gap-1.5">
                <IconClock width={17} height={17} className="text-link" />
                <span className="tnum font-semibold text-ink">{formatHeure(ag.dateAg, ctx.locale)}</span>
              </span>
              {ag.statut === "PLANIFIEE" || ag.statut === "CONVOQUEE" ? (
                <EcheanceRelative iso={ag.dateAg} dict={dict} />
              ) : null}
            </p>
            {ag.dateConvocation ? (
              <p className="mt-1.5 text-[13px] text-soft">
                {fill(a.convocationEnvoyeeLe, { date: formatDate(ag.dateConvocation, ctx.locale) })}
              </p>
            ) : null}
          </div>

          <div className="rounded-[20px] bg-surface p-5">
            <p className="text-[13px] font-medium text-soft">{a.quorum}</p>
            <p className="tnum mt-1 text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">
              {quorumAtteint !== null
                ? formatPourcent(ag.quorumAtteint)
                : quorumRequis !== null
                  ? formatPourcent(ag.quorumRequis)
                  : "—"}
            </p>
            {quorumAtteint !== null || quorumRequis !== null ? (
              <QuorumJauge atteint={quorumAtteint} requis={quorumRequis} />
            ) : null}
            <div className="mt-3 space-y-1 text-[13px]">
              {quorumAtteint !== null ? (
                <p className="font-semibold text-ink">
                  {fill(a.quorumAtteint, { val: formatPourcent(ag.quorumAtteint) })}
                </p>
              ) : null}
              {quorumRequis !== null ? (
                <p className="text-soft">{fill(a.quorumRequis, { val: formatPourcent(ag.quorumRequis) })}</p>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-3 text-[13px]">
              <span className="text-soft">{a.resolutions}</span>
              <span className="tnum font-semibold text-ink">{resolutions.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {ag.statut === "ANNULEE" ? (
        <Banner variant="danger" title={a.motifAnnulation} className="mb-6">
          {ag.motifAnnulation}
          {gestion ? (
            <span className="mt-2 block">
              <ButtonLink href={p("/ag/nouvelle")} variant="secondary" size="sm">
                {a.recreer}
              </ButtonLink>
            </span>
          ) : null}
        </Banner>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Résolutions */}
        <div className="space-y-4 lg:col-span-2">
          <SectionHeader
            title={
              <>
                {a.resolutions}
                <span className="tnum ms-2 text-[15px] font-semibold text-soft">{resolutions.length}</span>
              </>
            }
            action={
              peutEditer ? (
                <ResolutionModal
                  dict={dict}
                  locale={ctx.locale}
                  agId={id}
                  prochainOrdre={prochainOrdre}
                />
              ) : undefined
            }
          />

          {resolutions.length === 0 ? (
            <EmptyState
              title={a.aucuneResolution}
              hint={a.aucuneResolutionAide}
              illustration="empty-ag"
              className="py-8"
            />
          ) : (
            resolutions.map((r) => {
              const resultats = resultatsParResolution.get(r.id);
              return (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-1 basis-64 items-start gap-3.5">
                      <span className="tnum flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-[15px] font-bold text-ink">
                        {r.ordre}
                      </span>
                      <div className="min-w-0 pt-1">
                        <p className="text-[15px] font-semibold leading-relaxed text-ink">{r.texte}</p>
                        <p className="mt-1.5 text-[13px] text-soft">
                          {dict.enums.typeMajorite[r.typeMajorite]} —{" "}
                          {dict.enums.typeMajoriteAide[r.typeMajorite]}
                        </p>
                      </div>
                    </div>
                    <Badge variant={resolutionVariant[r.resultat]}>
                      {dict.enums.resultatResolution[r.resultat]}
                    </Badge>
                  </div>

                  {resultats && resultats.length > 0 ? (
                    <ResultatsAgreges dict={dict} resultats={resultats} />
                  ) : null}
                  {(() => {
                    const ex = executionParResolution.get(r.id);
                    if (!ex || (!ex.necessite_execution && ex.taches.length === 0)) return null;
                    return (
                      <div className="mt-4 rounded-2xl bg-surface px-4 py-3.5">
                        <p className="text-[13px] font-semibold text-ink">{dict.taches.execution}</p>
                        {ex.taches.length === 0 ? <p className="mt-1 text-[13px] text-soft">{dict.taches.aucuneTacheExecution}</p> : (
                          <ul className="mt-2 space-y-2">
                            {ex.taches.map((tk) => (
                              <li key={tk.tache_id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                                <span className="text-ink-strong">{gestion ? <a href={p(`/taches/${tk.tache_id}`)} className="link">{tk.titre}</a> : tk.titre}</span>
                                <span className="flex items-center gap-1.5"><Badge variant={tacheVariant[tk.statut]}>{dict.enumsTaches.statut[tk.statut]}</Badge>{tk.en_retard ? <Badge variant="danger">{dict.taches.enRetard}</Badge> : null}{tk.date_echeance ? <span className="tnum text-[12px] text-soft">{formatDate(tk.date_echeance, ctx.locale)}</span> : null}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                  {ag.statut === "CLOTUREE" && gestion ? (
                    <p className="mt-4 text-end">
                      <a
                        href={p(`/ag/${id}/resolutions/${r.id}/votes`)}
                        className="link text-[13px]"
                      >
                        {a.detailVotes}
                      </a>
                    </p>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>

        {/* Colonne latérale : actions + procurations */}
        <div className="space-y-4">
          {gestion && ag.statut === "PLANIFIEE" ? (
            <Card>
              <SectionHeader title={a.convoquer} subtitle={a.convoquerAide} />
              <div className="mt-4 space-y-3">
                <ConvoquerForm dict={dict} locale={ctx.locale} agId={id} />
                <AnnulerModal dict={dict} locale={ctx.locale} agId={id} />
              </div>
            </Card>
          ) : null}

          {gestion && ag.statut === "CONVOQUEE" ? (
            <Card>
              <SectionHeader title={a.ouvrirSeance} subtitle={a.ouvrirSeanceAide} />
              <div className="mt-4 space-y-3">
                <OuvrirForm dict={dict} locale={ctx.locale} agId={id} />
                <AnnulerModal dict={dict} locale={ctx.locale} agId={id} />
              </div>
            </Card>
          ) : null}

          {/* E4 — procurations, tant que l'AG n'est ni clôturée ni annulée */}
          {(gestion || votant) && ["PLANIFIEE", "CONVOQUEE"].includes(ag.statut) ? (
            <Card id="procurations">
              <SectionHeader title={a.procurations} subtitle={a.procurationsAide} />
              <div className="mt-4 space-y-3">
                {procurations.length > 0 ? (
                  <ul className="space-y-2">
                    {procurations.map((proc) => (
                      <li
                        key={proc.id}
                        className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3"
                      >
                        <span className="flex shrink-0 -space-x-1.5 rtl:space-x-reverse">
                          <Avatar
                            nom={membreParId.get(proc.mandantId) ?? a.mandant}
                            size={32}
                            className="ring-2 ring-surface"
                          />
                          <Avatar
                            nom={membreParId.get(proc.mandataireId) ?? a.mandataire}
                            size={32}
                            className="ring-2 ring-surface"
                          />
                        </span>
                        <div className="min-w-0 flex-1 text-[13px]">
                          <p className="font-semibold text-ink">
                            {membreParId.get(proc.mandantId) ?? a.mandant}{" "}
                            <span className="icon-flip inline-block text-link">→</span>{" "}
                            {membreParId.get(proc.mandataireId) ?? a.mandataire}
                          </p>
                          <p className="text-[12px] text-soft">
                            {dict.invitations.lot} {lotParId.get(proc.lotId) ?? "—"}
                          </p>
                        </div>
                        {gestion || proc.mandantId === ctx.profil.id ? (
                          <RevoquerForm
                            dict={dict}
                            locale={ctx.locale}
                            agId={id}
                            procurationId={proc.id}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-soft">{dict.common.emptyDefault}</p>
                )}
                {(gestion || mesLots.length > 0) ? (
                  <ProcurationModal
                    dict={dict}
                    locale={ctx.locale}
                    agId={id}
                    mesLots={(gestion ? lots : mesLots).map((l) => ({ id: l.id, numero: l.numero }))}
                    membres={membres}
                    syndic={gestion}
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          {ag.statut === "EN_COURS" ? (
            <Banner variant="warn" title={a.seance}>
              {votant ? a.voteImmuable : null}
            </Banner>
          ) : null}

          {!gestion && votant && ag.statut === "CLOTUREE" ? (
            <Banner variant="info">{a.voteAnonymeNote}</Banner>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Jauge de quorum : remplissage = quorum constaté, repère = seuil requis (ratios fournis). */
function QuorumJauge({ atteint, requis }: { atteint: number | null; requis: number | null }) {
  const pct = (v: number) => Math.max(0, Math.min(1, v)) * 100;
  return (
    <div className="relative mt-4 h-3 w-full rounded-full bg-wash">
      {atteint !== null ? (
        <div className="pb-fill h-full rounded-full bg-brand" style={{ width: `${pct(atteint)}%` }} />
      ) : null}
      {requis !== null ? (
        <span
          aria-hidden
          className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-ink rtl:translate-x-1/2"
          style={{ insetInlineStart: `${pct(requis)}%` }}
        />
      ) : null}
    </div>
  );
}

function ResultatsAgreges({ dict, resultats }: { dict: Dict; resultats: AgResultatLigne[] }) {
  const total = resultats.reduce((acc, r) => acc + Number(r.tantiemes_total), 0);
  const ordre: ValeurVote[] = ["POUR", "CONTRE", "ABSTENTION"];
  const colors: Record<ValeurVote, string> = {
    POUR: "var(--color-brand)",
    CONTRE: "var(--color-danger)",
    ABSTENTION: "var(--color-lilac-mid)",
  };
  return (
    <div className="mt-5 rounded-2xl bg-surface p-4 sm:p-5">
      <Donut
        size={124}
        centerLabel={formatEntier(total)}
        centerSub={dict.ag.tantiemes}
        items={ordre.map((v) => {
          const ligne = resultats.find((r) => r.valeur === v);
          const tantiemes = ligne ? Number(ligne.tantiemes_total) : 0;
          return {
            label: dict.enums.valeurVote[v],
            value: tantiemes,
            display: (
              <>
                {formatEntier(tantiemes)}{" "}
                <span className="font-normal text-soft">{dict.ag.tantiemes}</span>
              </>
            ),
            color: colors[v],
          };
        })}
      />
    </div>
  );
}
