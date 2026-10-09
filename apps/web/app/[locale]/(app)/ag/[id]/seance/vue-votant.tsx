"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "../../../../../../components/ui/banner";
import { Button } from "../../../../../../components/ui/button";
import { IconButton } from "../../../../../../components/ui/pressable";
import { Field, Select } from "../../../../../../components/ui/field";
import { FormAlert, SubmitButton } from "../../../../../../components/ui/form";
import { Modal } from "../../../../../../components/ui/modal";
import { IDLE } from "../../../../../../lib/forms";
import { fill, type Dict, type Locale } from "../../../../../../lib/i18n";
import type { AgResolution, ValeurVote } from "../../../../../../lib/api/types";
import { voter } from "../../actions";
import { IconCheck, IconX } from "../../../../../../components/ui/icons";
import { celebrate } from "../../../../../../lib/success";
import { SalleSeance } from "./salle";

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
      // Vote = action majeure : écran de succès plein (Wise).
      celebrate({
        titre: a.voteEnregistre,
        corps: `${dict.enums.valeurVote[d.valeur]} · ${a.voteImmuable}`,
        illustration: "ok-vote",
        moment: "vote",
      });
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

  const changer = (i: number) => {
    setIndex(Math.max(0, Math.min(statuts.length - 1, i)));
    setChoix(null);
  };

  const gestes: Array<{ v: ValeurVote; pastille: string; icone: ReactNode }> = [
    { v: "POUR", pastille: "bg-ok-tint text-ok", icone: <IconCheck width={22} height={22} /> },
    { v: "CONTRE", pastille: "bg-danger-tint text-danger", icone: <IconX width={22} height={22} /> },
    {
      v: "ABSTENTION",
      pastille: "bg-wash-strong text-ink",
      icone: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 12h12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Salle verte : résolution active en affiche + navigation. */}
      <SalleSeance
        dict={dict}
        resolutions={statuts}
        index={index}
        onPrev={index > 0 ? () => changer(index - 1) : undefined}
        onNext={index < statuts.length - 1 ? () => changer(index + 1) : undefined}
      />

      {/* VoteCard */}
      <div className="card p-5 sm:p-7">
        {identiteOptions.length > 1 ? (
          <Field label={a.voterEnTantQue} htmlFor="identite">
            <Select id="identite" value={identite} onChange={(e) => setIdentite(e.target.value)}>
              {identiteOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : identiteOptions.length === 1 ? (
          <p className="text-[14px] font-semibold text-ink-strong">{identiteOptions[0]!.label}</p>
        ) : null}

        {voteExistant || resolution.resultat !== "EN_ATTENTE" ? (
          <div className={identiteOptions.length > 0 ? "mt-5" : ""}>
            {voteExistant ? (
              <div className="flex items-center gap-3.5 rounded-[20px] bg-ok-tint px-4 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                  <IconCheck width={20} height={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-ink">{a.voteEnregistre}</p>
                  <p className="mt-0.5 text-[13px] text-body">
                    {dict.enums.valeurVote[voteExistant]} · {a.voteImmuable}
                  </p>
                </div>
              </div>
            ) : (
              <Banner variant="info">{a.dejaVote}</Banner>
            )}
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${identiteOptions.length > 0 ? "mt-5" : ""}`}>
            {gestes.map(({ v, pastille, icone }) => {
              const choisi = choix === v;
              return (
                <IconButton
                  key={v}
                  tone="none"
                  label={dict.enums.valeurVote[v]}
                  onClick={() => setChoix(v)}
                  disabled={!identite}
                  aria-pressed={choisi}
                  className={`group h-16 w-full justify-start gap-3 ps-2 pe-5 text-start transition-colors sm:h-[68px] ${
                    choisi ? "bg-cta text-ink" : "bg-surface text-ink hover:bg-lime-hover/40"
                  }`}
                >
                  <span
                    className={`flex size-12 shrink-0 items-center justify-center rounded-full transition-colors ${
                      choisi ? "bg-ink text-lime" : pastille
                    }`}
                  >
                    {icone}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[17px] font-bold">
                    {dict.enums.valeurVote[v]}
                  </span>
                </IconButton>
              );
            })}
          </div>
        )}

        {dejaVoteErreur ? (
          <p className="mt-4 text-[13px] font-medium text-warn">{a.dejaVote}</p>
        ) : state.status === "error" && !dejaVoteErreur ? (
          <div className="mt-4">
            <FormAlert state={state} />
          </div>
        ) : null}
      </div>

      <p className="text-center text-[13px] text-soft">{a.voteAnonymeNote}</p>

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
