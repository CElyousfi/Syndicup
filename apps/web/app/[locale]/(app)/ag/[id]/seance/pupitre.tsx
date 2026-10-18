"use client";

import { useEffect, useState } from "react";
import { Pressable } from "../../../../../../components/ui/pressable";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { SectionHeader } from "../../../../../../components/ui/card";
import { ConfirmAction } from "../../../../../../components/ui/confirm-action";
import { Figure } from "../../../../../../components/ui/amount";
import { LiveList } from "../../../../../../components/ui/live-list";
import { Donut } from "../../../../../../components/ui/charts";

import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type {
  AgResolution,
  AgResultatLigne,
  ValeurVote,
} from "../../../../../../lib/api/types";
import { formatEntier } from "../../../../../../lib/format";
import { resolutionVariant } from "../../../../../../lib/status";
import { finaliserResolution, cloturerAg } from "../../actions";
import { CloturerModal } from "../ag-actions";
import { SalleSeance } from "./salle";
import { StaleIndicator, useStale } from "../../../../../../components/ui/stale-indicator";

/**
 * E5 — pupitre de séance (syndic) : résultats agrégés en direct, finalisation résolution par
 * résolution (égalité parfaite = rejetée), puis clôture irréversible qui génère le PV.
 */
export function Pupitre({
  dict,
  locale,
  agId,
  resolutions: initiales,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  resolutions: AgResolution[];
}) {
  const a = dict.ag;
  const [resolutions, setResolutions] = useState(initiales);
  const [index, setIndex] = useState(() => {
    const premiere = initiales.findIndex((r) => r.resultat === "EN_ATTENTE");
    return premiere === -1 ? 0 : premiere;
  });
  const [resultats, setResultats] = useState<AgResultatLigne[] | null>(null);
  const [chargement, setChargement] = useState(true);
  // Chaque finalisation relance aussitôt la lecture des agrégats (résultat figé).
  const [finalisations, setFinalisations] = useState(0);

  const resolution = resolutions[index];

  // Rafraîchissement live des agrégats (5 s). Un échec n'est jamais silencieux : la pastille
  // « Connexion perdue — dernière mise à jour il y a … » s'affiche jusqu'au prochain succès.
  const stale = useStale();
  const { ok: staleOk, fail: staleFail } = stale;
  const [essai, setEssai] = useState(0);
  useEffect(() => {
    if (!resolution) return;
    let annule = false;
    const charger = async () => {
      try {
        const r = await fetch(
          `/api/ag-resultats?ag=${agId}&resolution=${resolution.id}`,
          { cache: "no-store" }
        );
        if (annule) return;
        if (!r.ok) {
          staleFail();
          return;
        }
        const data = (await r.json()) as {
          resolutions: AgResolution[];
          resultats: AgResultatLigne[] | null;
        };
        setResolutions(data.resolutions);
        setResultats(data.resultats);
        setChargement(false);
        staleOk();
      } catch (e) {
        // Hors-ligne passager : signalé à l'écran, nouvel essai au tick suivant.
        if (!annule) staleFail();
        console.warn(JSON.stringify({ niveau: "warn", message: "pupitre : resultats indisponibles", erreur: String(e) }));
      }
    };
    void charger();
    const timer = setInterval(charger, 5000);
    return () => {
      annule = true;
      clearInterval(timer);
    };
  }, [agId, resolution?.id, resolution, finalisations, essai, staleOk, staleFail]);

  if (!resolution) return <Banner variant="info">{a.aucuneResolution}</Banner>;

  const enAttente = resolutions.filter((r) => r.resultat === "EN_ATTENTE").length;
  const totalTantiemes = (resultats ?? []).reduce((acc, r) => acc + Number(r.tantiemes_total), 0);
  const totalVotants = (resultats ?? []).reduce((acc, r) => acc + r.nb_votants, 0);

  const ordre: ValeurVote[] = ["POUR", "CONTRE", "ABSTENTION"];
  const couleurs: Record<ValeurVote, string> = {
    POUR: "var(--color-brand)",
    CONTRE: "var(--color-danger)",
    ABSTENTION: "var(--color-lilac-mid)",
  };

  const choisir = (i: number) => {
    if (i === index || i < 0 || i >= resolutions.length) return;
    setIndex(i);
    setResultats(null);
    setChargement(true);
  };

  return (
    <div className="space-y-6">
      <StaleIndicator
        failing={stale.failing}
        lastUpdated={stale.lastUpdated}
        labels={dict.errors.stale}
        onRetry={() => setEssai((n) => n + 1)}
      />
      {/* Salle verte : la résolution courante en affiche. */}
      <SalleSeance
        dict={dict}
        resolutions={resolutions}
        index={index}
        onPrev={index > 0 ? () => choisir(index - 1) : undefined}
        onNext={index < resolutions.length - 1 ? () => choisir(index + 1) : undefined}
        onSelect={choisir}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ordre du jour */}
        <div className="min-w-0">
          <SectionHeader title={a.resolutions} className="mb-3" />
          <LiveList as="ul" className="-mx-2 space-y-1">
            {resolutions.map((r, i) => (
              <li key={r.id}>
                <Pressable
                  type="button"
                  onClick={() => choisir(i)}
                  aria-current={i === index ? "true" : undefined}
                  className={`su-btn flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-start transition-colors ${
                    i === index ? "bg-wash" : "hover:bg-wash"
                  }`}
                >
                  <span
                    className={`tnum flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
                      i === index ? "bg-cta text-ink" : "bg-tile text-ink-strong"
                    }`}
                  >
                    {r.ordre}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[14px] text-ink ${i === index ? "font-bold" : "font-medium"}`}>
                    {r.texte}
                  </span>
                  <Badge variant={resolutionVariant[r.resultat]}>
                    {dict.enums.resultatResolution[r.resultat]}
                  </Badge>
                </Pressable>
              </li>
            ))}
          </LiveList>
        </div>

        {/* Résolution active : agrégats live + finalisation */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5 sm:p-7">
            <SectionHeader
              title={a.resultats}
              action={
                <p className="tnum pt-1 text-[13px] text-soft">
                  {chargement ? (
                    <span aria-hidden className="skeleton inline-block h-3.5 w-36 rounded-full align-middle" />
                  ) : (
                    <>
                      <Figure value={fill(a.votants, { n: totalVotants })} /> ·{" "}
                      <Figure value={formatEntier(totalTantiemes)} /> {a.tantiemes}
                    </>
                  )}
                </p>
              }
            />
            <div className="mt-5 rounded-2xl bg-surface p-4 sm:p-5">
              <Donut
                size={148}
                centerLabel={<Figure value={formatEntier(totalTantiemes)} />}
                centerSub={a.tantiemes}
                items={ordre.map((v) => {
                  const ligne = (resultats ?? []).find((r) => r.valeur === v);
                  const tantiemes = ligne ? Number(ligne.tantiemes_total) : 0;
                  return {
                    label: dict.enums.valeurVote[v],
                    value: tantiemes,
                    display: (
                      <>
                        <Figure value={String(ligne ? ligne.nb_votants : 0)} /> ·{" "}
                        <Figure value={formatEntier(tantiemes)} />{" "}
                        <span className="font-normal text-soft">{a.tantiemes}</span>
                      </>
                    ),
                    color: couleurs[v],
                  };
                })}
              />
            </div>

            {resolution.resultat === "EN_ATTENTE" ? (
              <div className="mt-6 space-y-3">
                <p className="text-[13px] leading-relaxed text-body">
                  {a.finaliserCorps} <span className="font-semibold text-warn">{a.egaliteRejetee}</span>
                </p>
                {/* Écriture probante (résultat inscrit au PV) : jamais en un clic. */}
                <ConfirmAction
                  key={resolution.id}
                  action={finaliserResolution}
                  fields={{ locale, ag_id: agId, resolution_id: resolution.id }}
                  triggerLabel={a.finaliser}
                  triggerVariant="primary"
                  triggerSize="lg"
                  triggerClassName="w-full sm:w-auto"
                  title={dict.formulaires.confirmer.finaliserTitre}
                  question={fill(dict.formulaires.confirmer.finaliserQuestion, { ordre: resolution.ordre })}
                  consequence={dict.formulaires.confirmer.finaliserConsequence}
                  irreversible
                  tone="primary"
                  confirmLabel={dict.formulaires.confirmer.finaliserConfirmer}
                  closeLabel={dict.common.close}
                  success={dict.formulaires.succes.resolutionFinalisee}
                  onSuccess={() => setFinalisations((n) => n + 1)}
                >
                  <p className="text-[13px] font-semibold text-warn">{a.egaliteRejetee}</p>
                </ConfirmAction>
              </div>
            ) : null}
          </div>

          {/* Clôture */}
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0 text-sm">
              {enAttente > 0 ? (
                <p className="font-semibold text-warn">{fill(a.restentEnAttente, { n: enAttente })}</p>
              ) : (
                <p className="font-semibold text-ok">{a.toutesFinalisees}</p>
              )}
              <p className="mt-1 max-w-md text-[13px] text-soft">{a.cloturerCorps}</p>
            </div>
            <CloturerModal dict={dict} locale={locale} agId={agId} action={cloturerAg} />
          </div>
        </div>
      </div>
    </div>
  );
}
