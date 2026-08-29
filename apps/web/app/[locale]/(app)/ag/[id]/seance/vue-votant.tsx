"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "../../../../../../components/ui/badge";
import { Banner } from "../../../../../../components/ui/banner";
import { Button } from "../../../../../../components/ui/button";
import { Field, Select } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Modal } from "../../../../../../components/ui/modal";
import { IDLE } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type { AgResolution, ValeurVote } from "../../../../../../lib/api/types";
import { resolutionVariant } from "../../../../../../lib/status";
import { voter } from "../../actions";
import { IconCheck } from "../../../../../../components/ui/icons";

interface ProcurationVotant {
  id: string;
  lotNumero: string;
  mandantNom: string;
}

/**
 * E5 — vue votant : la résolution active en grand, trois gestes, confirmation explicite,
 * puis « vote enregistré » (immuable). Une identité de vote par lot possédé + une par
 * procuration reçue.
 */
export function VueVotant({
  dict,
  locale,
  agId,
  resolutions,
  mesLots,
  procurations,
}: {
  dict: Dict;
  locale: Locale;
  agId: string;
  resolutions: AgResolution[];
  mesLots: Array<{ id: string; numero: string }>;
  procurations: ProcurationVotant[];
}) {
  const a = dict.ag;
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    const premiere = resolutions.findIndex((r) => r.resultat === "EN_ATTENTE");
    return premiere === -1 ? 0 : premiere;
  });
  const [choix, setChoix] = useState<ValeurVote | null>(null);
  const [identite, setIdentite] = useState<string>(
    mesLots[0] ? `lot:${mesLots[0].id}` : procurations[0] ? `proc:${procurations[0].id}` : ""
  );
  // Votes confirmés localement : clé = resolutionId|identite.
  const [votes, setVotes] = useState<Record<string, ValeurVote>>({});
  const [state, action] = useActionState(voter, IDLE);
  const [statuts, setStatuts] = useState(resolutions);

  const resolution = statuts[index];

  // Suivi léger de la séance : résolutions finalisées / clôture.
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/ag-resultats?ag=${agId}`, { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { statut: string; resolutions: AgResolution[] };
        if (data.statut === "CLOTUREE") {
          router.push(`/${locale}/ag/${agId}`);
          return;
        }
        setStatuts(data.resolutions);
      } catch {
        // hors-ligne passager : on retentera au tick suivant
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [agId, locale, router]);

  const cleVote = resolution ? `${resolution.id}|${identite}` : "";
  const voteExistant = votes[cleVote];

  useEffect(() => {
    if (state.status === "success") {
      const d = state.data as { resolutionId: string; valeur: ValeurVote };
      setVotes((v) => ({ ...v, [`${d.resolutionId}|${identite}`]: d.valeur }));
      setChoix(null);
    }
    // (identite volontairement hors dépendances : on n'applique le vote qu'au retour d'action)
  }, [state]);

  const identiteOptions = useMemo(
    () => [
      ...mesLots.map((l) => ({
        value: `lot:${l.id}`,
        label: fill(a.voterPourLot, { numero: l.numero }),
      })),
      ...procurations.map((p) => ({
        value: `proc:${p.id}`,
        label: `${fill(a.viaProcuration, { nom: p.mandantNom })} · ${p.lotNumero}`,
      })),
    ],
    [mesLots, procurations, a]
  );

  if (!resolution) {
    return <Banner variant="info">{a.aucuneResolution}</Banner>;
  }

  const dejaVoteErreur =
    state.status === "error" &&
    (state.code === "CONFLICT" || /déjà voté/i.test(state.message));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Navigation résolutions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="md"
          className="h-11"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1));
            setChoix(null);
          }}
        >
          {a.resolutionPrecedente}
        </Button>
        <span className="tnum text-[13px] font-medium text-soft">
          {index + 1} / {statuts.length}
        </span>
        <Button
          variant="ghost"
          size="md"
          className="h-11"
          disabled={index >= statuts.length - 1}
          onClick={() => {
            setIndex((i) => Math.min(statuts.length - 1, i + 1));
            setChoix(null);
          }}
        >
          {a.resolutionSuivante}
        </Button>
      </div>

      {/* VoteCard */}
      <div className="card p-5 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <span className="tnum flex size-9 items-center justify-center rounded-full bg-action-tint text-[15px] font-semibold text-action">
            {resolution.ordre}
          </span>
          <Badge variant={resolutionVariant[resolution.resultat]}>
            {dict.enums.resultatResolution[resolution.resultat]}
          </Badge>
        </div>
        <p className="mt-5 text-lg font-medium leading-relaxed text-ink">{resolution.texte}</p>
        <p className="mt-2 text-[13px] text-soft">
          {dict.enums.typeMajorite[resolution.typeMajorite]} —{" "}
          {dict.enums.typeMajoriteAide[resolution.typeMajorite]}
        </p>

        {identiteOptions.length > 1 ? (
          <div className="mt-6">
            <Field label={a.voterEnTantQue} htmlFor="identite">
              <Select id="identite" value={identite} onChange={(e) => setIdentite(e.target.value)}>
                {identiteOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : identiteOptions.length === 1 ? (
          <p className="mt-6 text-[13px] font-medium text-soft">{identiteOptions[0]!.label}</p>
        ) : null}

        {voteExistant || resolution.resultat !== "EN_ATTENTE" ? (
          <div className="mt-6 space-y-3">
            {voteExistant ? (
              <div className="flex items-center gap-3 rounded-xl bg-ok-tint px-4 py-3.5">
                <span className="flex size-8 items-center justify-center rounded-full bg-ok text-white">
                  <IconCheck width={16} height={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{a.voteEnregistre}</p>
                  <p className="text-[12px] text-soft">
                    {dict.enums.valeurVote[voteExistant]} · {a.voteImmuable}
                  </p>
                </div>
              </div>
            ) : (
              <Banner variant="info">{a.dejaVote}</Banner>
            )}
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                { v: "POUR" as const, cls: "border-ok text-ok hover:bg-ok hover:text-white" },
                {
                  v: "CONTRE" as const,
                  cls: "border-danger text-danger hover:bg-danger hover:text-white",
                },
                {
                  v: "ABSTENTION" as const,
                  cls: "border-hairline-strong text-body hover:bg-ink hover:border-ink hover:text-white",
                },
              ] as Array<{ v: ValeurVote; cls: string }>
            ).map(({ v, cls }) => (
              <button
                key={v}
                type="button"
                onClick={() => setChoix(v)}
                disabled={!identite}
                className={`h-14 rounded-btn border-2 text-[15px] font-semibold transition-colors disabled:opacity-40 sm:h-16 ${cls}`}
              >
                {dict.enums.valeurVote[v]}
              </button>
            ))}
          </div>
        )}

        {dejaVoteErreur ? (
          <p className="mt-4 text-[13px] text-warn">{a.dejaVote}</p>
        ) : state.status === "error" && !dejaVoteErreur ? (
          <div className="mt-4">
            <FormAlert state={state} />
          </div>
        ) : null}
      </div>

      <p className="text-center text-[12px] text-faint">{a.voteAnonymeNote}</p>

      {/* Confirmation du vote */}
      <Modal
        open={choix !== null}
        onClose={() => setChoix(null)}
        title={a.voteConfirmTitre}
        closeLabel={dict.common.close}
      >
        {choix ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="ag_id" value={agId} />
            <input type="hidden" name="resolution_id" value={resolution.id} />
            <input type="hidden" name="valeur" value={choix} />
            {identite.startsWith("lot:") ? (
              <input type="hidden" name="lot_id" value={identite.slice(4)} />
            ) : (
              <input type="hidden" name="procuration_id" value={identite.slice(5)} />
            )}
            <p className="text-sm leading-relaxed text-body">
              {fill(a.voteConfirmCorps, {
                valeur: dict.enums.valeurVote[choix],
                ordre: resolution.ordre,
              })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="lg" onClick={() => setChoix(null)}>
                {dict.common.cancel}
              </Button>
              <SubmitButton size="lg">{a.voter}</SubmitButton>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
