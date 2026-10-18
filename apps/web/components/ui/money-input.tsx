"use client";

import type { ComponentProps } from "react";
import { Input } from "./field";
import { lecturesAmbigues, montantAmbigu, parseMontant } from "../../lib/centimes";

/**
 * Champ de montant en MAD — accepte la saisie naturelle au Maroc : « 1 250,50 », « 1.250,50 »,
 * « 1,250.50 », « 1250 ». Une saisie invalide est refusée AVANT l'envoi avec `invalidMessage` ;
 * une saisie AMBIGUË (« 1.250 » : 1 250 ou 1,25 ?) avec `ambiguousMessage` (« {choix} »). Même
 * spécification que le mobile (lib/centimes.ts `parseMontant`). La Server Action renormalise
 * de son côté (`montantSaisi`) — le serveur ne fait jamais confiance au navigateur.
 *
 * Non contrôlé par défaut (`defaultValue`) ; `value`/`onChange` restent possibles.
 */
export function MoneyInput({
  invalidMessage,
  ambiguousMessage,
  orLabel,
  className = "",
  onInput,
  onInvalid,
  ...props
}: Omit<ComponentProps<"input">, "type" | "inputMode" | "pattern"> & {
  /** Message affiché par le navigateur quand la saisie n'est pas un montant. */
  invalidMessage: string;
  /** « Montant ambigu : {choix} ? » — {choix} = lectures possibles séparées par `orLabel`. */
  ambiguousMessage: string;
  orLabel: string;
}) {
  const verifier = (el: HTMLInputElement) => {
    const v = el.value.trim();
    if (v === "" || parseMontant(v) !== null) el.setCustomValidity("");
    else if (montantAmbigu(v)) el.setCustomValidity(ambiguousMessage.replace("{choix}", lecturesAmbigues(v).map((x) => `\u2066${x}\u2069`).join(orLabel)));
    else el.setCustomValidity(invalidMessage);
  };
  return (
    <Input
      type="text"
      inputMode="decimal"
      dir="ltr"
      autoComplete="off"
      {...props}
      className={`tnum text-start ${className}`}
      onInput={(e) => {
        verifier(e.currentTarget);
        onInput?.(e);
      }}
      onInvalid={(e) => {
        verifier(e.currentTarget);
        onInvalid?.(e);
      }}
    />
  );
}
