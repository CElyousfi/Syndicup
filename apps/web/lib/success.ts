/**
 * Écran de succès plein écran (langage Wise, identique au mobile `showSuccess`) — réservé aux
 * actions MAJEURES (paiement, signalement, vote, réservation, invitation…). Les retours mineurs
 * restent des toasts. Événement DOM, aucun contexte React : <SuccessOverlay/> de la coque l'affiche.
 */
export interface SuccessInput {
  titre: string;
  corps?: string;
  /** Nom d'illustration (public/illustrations) : ok-paiement, ok-incident, ok-vote, ok-reservation,
   *  ok-invitation, ok-visiteur, ok-general. */
  illustration?: string;
  /** Lien secondaire « Voir » (ex. le détail créé). */
  href?: string;
  hrefLabel?: string;
}

export const SUCCESS_EVENT = "su:success";

export function celebrate(input: SuccessInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SuccessInput>(SUCCESS_EVENT, { detail: input }));
}
