"use client";

import { useEffect, useState } from "react";
import type { FormState } from "../../lib/forms";

/** Issues où l'on NE SAIT PAS si l'écriture a eu lieu : la même clé doit être rejouée. */
const ISSUE_INCONNUE = new Set(["NETWORK", "INTERNAL_ERROR", "SERVICE_UNAVAILABLE", "UNEXPECTED"]);

/**
 * Clé d'idempotence d'un geste (`idempotency_key`, UUID) — tirée une fois au montage du
 * formulaire (le corps d'une ActionModal est remonté à chaque ouverture) : un double envoi ou
 * un « Réessayer » après une coupure rejoue la MÊME clé, l'API ne crée jamais deux fois.
 * Après un refus certain (validation, conflit, droits…), l'écriture n'a pas eu lieu : une clé
 * neuve est tirée, pour que la saisie corrigée (fichiers re-téléversés compris) ne soit pas
 * prise pour un rejeu au contenu différent (409).
 * Tirée après l'hydratation : aucune différence entre rendu serveur et client.
 */
export function IdempotencyField({ state }: { state?: FormState }) {
  const [cle, setCle] = useState("");
  useEffect(() => setCle(crypto.randomUUID()), []);
  useEffect(() => {
    if (state?.status === "error" && !ISSUE_INCONNUE.has(state.code)) setCle(crypto.randomUUID());
  }, [state]);
  return <input type="hidden" name="idempotency_key" value={cle} />;
}
