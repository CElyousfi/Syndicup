import { notFound } from "next/navigation";
import { getAppContext } from "../../../../../lib/app-context";
import { apiFetch } from "../../../../../lib/api/client";
import { annuaireMembres } from "../../../../../lib/membres";
import { getLots } from "../../../../../lib/finances-data";
import type {
  AgProcuration,
  AgResultatLigne,
  AssembleeGenerale,
  ValeurVote,
} from "../../../../../lib/api/types";
import { fill, type Dict } from "../../../../../lib/i18n";
import { formatDateHeure, formatDate, formatEntier, formatPourcent } from "../../../../../lib/format";
import { PageHeader, BackLink } from "../../../../../components/page-header";
import { Badge } from "../../../../../components/ui/badge";
import { Banner } from "../../../../../components/ui/banner";
import { ButtonLink } from "../../../../../components/ui/button";
import { Card, SectionHeader } from "../../../../../components/ui/card";
import { ProgressBar } from "../../../../../components/ui/progress";
import { Avatar } from "../../../../../components/ui/avatar";
import { Donut } from "../../../../../components/ui/charts";
import { CVote, IconCircle } from "../../../../../components/ui/color-icons";
import { agVariant, resolutionVariant } from "../../../../../lib/status";
import {
  AnnulerModal,
  ConvoquerForm,
  OuvrirForm,
  ProcurationModal,
  ResolutionModal,
  RevoquerForm,
} from "./ag-actions";
import { EcheanceRelative } from "../../tableau-de-bord/syndic";
import { IconVote } from "../../../../../components/ui/icons";

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

  return (
    <div className="animate-fade">
      <PageHeader
        back={<BackLink href={p("/ag")} label={dict.nav.ag} />}
        title={
          <span className="flex items-center gap-3">
            <IconCircle tone="lilac" size={44}>
              <CVote />
            </IconCircle>
            {dict.enums.typeAg[ag.type]}
          </span>
        }
        badge={
          <Badge variant={agVariant[ag.statut]} pulse={ag.statut === "EN_COURS"}>
            {dict.enums.statutAg[ag.statut]}
          </Badge>
        }
        subtitle={
          <>
            {formatDateHeure(ag.dateAg, ctx.locale)}
            {ag.dateConvocation
              ? ` · ${fill(a.convocationEnvoyeeLe, { date: formatDate(ag.dateConvocation, ctx.locale) })}`
              : ""}
          </>
        }
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

      {ag.statut === "ANNULEE" ? (
        <Banner variant="danger" title={a.motifAnnulation} className="mb-5">
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

      {ag.statut === "CONVOQUEE" ? (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <EcheanceRelative iso={ag.dateAg} dict={dict} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Résolutions */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">
              {a.resolutions}
              <span className="ms-2 text-[13px] font-normal text-soft">{resolutions.length}</span>
            </h2>
            {peutEditer ? (
              <ResolutionModal
                dict={dict}
                locale={ctx.locale}
                agId={id}
                prochainOrdre={prochainOrdre}
              />
            ) : null}
          </div>

          {resolutions.length === 0 ? (
            <Card>
              <p className="text-sm text-soft">{a.aucuneResolution}</p>
              <p className="mt-1 text-[13px] text-faint">{a.aucuneResolutionAide}</p>
            </Card>
          ) : (
            resolutions.map((r) => {
              const resultats = resultatsParResolution.get(r.id);
              return (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
                      <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-action-tint text-[13px] font-semibold text-action">
                        {r.ordre}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm leading-relaxed text-ink">{r.texte}</p>
                        <p className="mt-1.5 text-[12px] text-soft">
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
                  {ag.statut === "CLOTUREE" && gestion ? (
                    <p className="mt-3 text-end">
                      <a
                        href={p(`/ag/${id}/resolutions/${r.id}/votes`)}
                        className="text-[12px] font-medium text-action hover:underline"
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

        {/* Colonne latérale : actions + quorum + procurations */}
        <div className="space-y-4">
          {ag.quorumRequis || ag.quorumAtteint ? (
            <Card>
              <SectionHeader title={a.quorum} />
              <div className="mt-4 space-y-4">
                {ag.quorumRequis ? (
                  <div>
                    <p className="text-[13px] text-body">
                      {fill(a.quorumRequis, { val: formatPourcent(ag.quorumRequis) })}
                    </p>
                    <ProgressBar ratio={Number(ag.quorumRequis)} tone="ink" className="mt-2" />
                  </div>
                ) : null}
                {ag.quorumAtteint ? (
                  <div>
                    <p className="text-[13px] font-medium text-ink">
                      {fill(a.quorumAtteint, { val: formatPourcent(ag.quorumAtteint) })}
                    </p>
                    <ProgressBar ratio={Number(ag.quorumAtteint)} tone="action" className="mt-2" />
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

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
                  <ul className="space-y-2.5">
                    {procurations.map((proc) => (
                      <li
                        key={proc.id}
                        className="flex items-center gap-3 rounded-xl border border-hairline px-3.5 py-2.5"
                      >
                        <span className="flex shrink-0 -space-x-1.5">
                          <Avatar
                            nom={membreParId.get(proc.mandantId) ?? a.mandant}
                            size={30}
                            className="ring-2 ring-surface"
                          />
                          <Avatar
                            nom={membreParId.get(proc.mandataireId) ?? a.mandataire}
                            size={30}
                            className="ring-2 ring-surface"
                          />
                        </span>
                        <div className="min-w-0 flex-1 text-[13px]">
                          <p className="font-medium text-ink">
                            {membreParId.get(proc.mandantId) ?? a.mandant} →{" "}
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

function ResultatsAgreges({ dict, resultats }: { dict: Dict; resultats: AgResultatLigne[] }) {
  const total = resultats.reduce((acc, r) => acc + Number(r.tantiemes_total), 0);
  const ordre: ValeurVote[] = ["POUR", "CONTRE", "ABSTENTION"];
  const colors: Record<ValeurVote, string> = {
    POUR: "var(--color-sage)",
    CONTRE: "var(--color-danger)",
    ABSTENTION: "var(--color-hairline-strong)",
  };
  return (
    <div className="mt-5 border-t border-hairline pt-5">
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
