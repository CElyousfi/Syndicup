/**
 * Toasts applicatifs — un événement DOM, zéro contexte React : n'importe quel composant client
 * (modale, formulaire, flux de notifications) appelle `toast(...)`, le <Toaster/> de la coque
 * l'affiche quelques secondes en bas de l'écran puis l'efface.
 */
export interface ToastInput {
  titre: string;
  corps?: string;
  /** Navigation au clic (page cible de la notification, ex. /fr/incidents/…). */
  href?: string;
  /** Notification associée : le clic la marque « lue » (optimiste, en arrière-plan). */
  notificationId?: string;
  tone?: "ok" | "info" | "warn" | "danger";
  /** Durée d'affichage en ms (défaut 6000). */
  duree?: number;
}

export const TOAST_EVENT = "su:toast";

export function toast(input: ToastInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastInput>(TOAST_EVENT, { detail: input }));
}
