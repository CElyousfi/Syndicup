"use client";

import type { ComponentProps } from "react";
import { Input } from "./field";
import { parseMontant } from "../../lib/centimes";

/**
 * Champ de montant en MAD — accepte la saisie naturelle au Maroc : « 1 250,50 », « 1250.50 »,
 * « 1250 ». Plus de 2 décimales (ou toute autre saisie) est refusé AVANT l'envoi, avec le
 * message localisé `invalidMessage` ; la Server Action renormalise de son côté (`montantSaisi`,
 * lib/centimes.ts) — le serveur ne fait jamais confiance au navigateur.
 *
 * Non contrôlé par défaut (`defaultValue`) ; `value`/`onChange` restent possibles.
 */
export function MoneyInput({
  invalidMessage,
  className = "",
  onInput,
  onInvalid,
  ...props
}: Omit<ComponentProps<"input">, "type" | "inputMode" | "pattern"> & {
  /** Message affiché par le navigateur quand la saisie n'est pas un montant. */
  invalidMessage: string;
}) {
  const verifier = (el: HTMLInputElement) => {
    const v = el.value.trim();
    el.setCustomValidity(v === "" || parseMontant(v) !== null ? "" : invalidMessage);
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
