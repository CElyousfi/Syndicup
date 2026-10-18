"use client";

import { useEffect, useState } from "react";
import { ISSUES_INCONNUES, type FormState } from "../../lib/forms";

/**
 * Clé d'idempotence d'un geste (`idempotency_key`, UUID) — tirée une fois au montage du
 * formulaire (le corps d'une ActionModal est remonté à chaque ouverture) : un double envoi ou
 * un « Réessayer » rejoue la MÊME clé, l'API ne crée jamais deux fois.
 *  - Issue inconnue (réseau, 5xx, 409 CONFLICT — voir ISSUES_INCONNUES) : la clé est GARDÉE, et
 *    les fichiers déjà téléversés sont renvoyés tels quels (<FichiersEnvoyes>) pour que le rejeu
 *    porte exactement le même contenu.
 *  - Refus certain (validation, droits, règle métier 4xx hors 409) : rien n'a été écrit, une clé
 *    neuve est tirée pour la saisie corrigée.
 *  - `renouveler` : change quand l'utilisateur remplace un fichier déjà envoyé (contenu
 *    volontairement différent) — clé neuve.
 * Tirée après l'hydratation : aucune différence entre rendu serveur et client.
 */
export function IdempotencyField({ state, renouveler = 0 }: { state?: FormState; renouveler?: number }) {
  const [cle, setCle] = useState("");
  useEffect(() => setCle(crypto.randomUUID()), [renouveler]);
  useEffect(() => {
    if (state?.status === "error" && !ISSUES_INCONNUES.has(state.code)) setCle(crypto.randomUUID());
  }, [state]);
  return <input type="hidden" name="idempotency_key" value={cle} />;
}
