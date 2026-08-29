"use client";

import { useActionState, useEffect, useState } from "react";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { FormAlert, SubmitButton, Spinner } from "../../../../../../components/ui/form";
import { Donut } from "../../../../../../components/ui/charts";
import { IDLE } from "../../../../../../lib/forms";
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
  const [finaliserState, finaliserAction] = useActionState(finaliserResolution, IDLE);

  const resolution = resolutions[index];

  // Rafraîchissement live des agrégats (5 s).
  useEffect(() => {
    if (!resolution) return;
    let annule = false;
    const charger = async () => {
      try {
        const r = await fetch(
          `/api/ag-resultats?ag=${agId}&resolution=${resolution.id}`,
          { cache: "no-store" }
        );
        if (!r.ok || annule) return;
        const data = (await r.json()) as {
          resolutions: AgResolution[];
          resultats: AgResultatLigne[] | null;
        };
        setResolutions(data.resolutions);
        setResultats(data.resultats);
        setChargement(false);
      } catch {
        // tick suivant
      }
    };
    void charger();
    const timer = setInterval(charger, 5000);
    return () => {
      annule = true;
      clearInterval(timer);
    };
  }, [agId, resolution?.id, resolution, finaliserState]);

  if (!resolution) return <Banner variant="info">{a.aucuneResolution}</Banner>;

  const enAttente = resolutions.filter((r) => r.resultat === "EN_ATTENTE").length;
  const totalTantiemes = (resultats ?? []).reduce((acc, r) => acc + Number(r.tantiemes_total), 0);
  const totalVotants = (resultats ?? []).reduce((acc, r) => acc + r.nb_votants, 0);

  const ordre: ValeurVote[] = ["POUR", "CONTRE", "ABSTENTION"];
  const couleurs: Record<ValeurVote, string> = {
    POUR: "var(--color-sage)",
    CONTRE: "var(--color-danger)",
    ABSTENTION: "var(--color-hairline-strong)",
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Liste des résolutions */}
      <div className="card divide-y divide-hairline overflow-hidden" >
        {resolutions.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setResultats(null);
              setChargement(true);
            }}
            className={`flex w-full items-center gap-3 px-5 py-3.5 text-start transition-colors ${
              i === index ? "bg-action-wash" : "hover:bg-hover"
            }`}
          >
            <span
              className={`tnum flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                i === index ? "bg-action text-white" : "bg-ground text-body"
              }`}
            >
              {r.ordre}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
              {r.texte}
            </span>
            <Badge variant={resolutionVariant[r.resultat]}>
              {dict.enums.resultatResolution[r.resultat]}
            </Badge>
          </button>
        ))}
      </div>

      {/* Résolution active */}
      <div className="space-y-4 lg:col-span-2">
        <div className="card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
            <p className="text-[15px] font-medium leading-relaxed text-ink">{resolution.texte}</p>
            <Badge variant={resolutionVariant[resolution.resultat]}>
              {dict.enums.resultatResolution[resolution.resultat]}
            </Badge>
          </div>
          <p className="mt-2 text-[13px] text-soft">
            {dict.enums.typeMajorite[resolution.typeMajorite]} —{" "}
            {dict.enums.typeMajoriteAide[resolution.typeMajorite]}
          </p>

          {/* Agrégats live */}
          <div className="mt-6 space-y-3 border-t border-hairline pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">{a.resultats}</p>
              <p className="tnum text-[12px] text-soft">
                {chargement ? (
                  <Spinner className="inline-block" />
                ) : (
                  <>
                    {fill(a.votants, { n: totalVotants })} ·{" "}
                    {formatEntier(totalTantiemes)} {a.tantiemes}
                  </>
                )}
              </p>
            </div>
            <Donut
              size={148}
              centerLabel={formatEntier(totalTantiemes)}
              centerSub={a.tantiemes}
              items={ordre.map((v) => {
                const ligne = (resultats ?? []).find((r) => r.valeur === v);
                const tantiemes = ligne ? Number(ligne.tantiemes_total) : 0;
                return {
                  label: dict.enums.valeurVote[v],
                  value: tantiemes,
                  display: (
                    <>
                      {ligne ? ligne.nb_votants : 0} ·{" "}
                      {formatEntier(tantiemes)}{" "}
                      <span className="font-normal text-soft">{a.tantiemes}</span>
                    </>
                  ),
                  color: couleurs[v],
                };
              })}
            />
          </div>

          {resolution.resultat === "EN_ATTENTE" ? (
            <form action={finaliserAction} className="mt-6 space-y-3 border-t border-hairline pt-5">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="ag_id" value={agId} />
              <input type="hidden" name="resolution_id" value={resolution.id} />
              <p className="text-[13px] leading-relaxed text-soft">
                {a.finaliserCorps} <span className="font-medium text-warn">{a.egaliteRejetee}</span>
              </p>
              <FormAlert state={finaliserState} />
              <SubmitButton variant="secondary" size="lg" className="w-full sm:w-auto">
                {a.finaliser}
              </SubmitButton>
            </form>
          ) : null}
        </div>

        {/* Clôture */}
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="text-sm">
            {enAttente > 0 ? (
              <p className="text-warn">{fill(a.restentEnAttente, { n: enAttente })}</p>
            ) : (
              <p className="font-medium text-ok">{a.toutesFinalisees}</p>
            )}
            <p className="mt-0.5 max-w-md text-[12px] text-faint">{a.cloturerCorps}</p>
          </div>
          <CloturerModal dict={dict} locale={locale} agId={agId} action={cloturerAg} />
        </div>
      </div>
    </div>
  );
}
