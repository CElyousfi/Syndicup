/**
 * Résultat d'une Server Action rendu VIVANT, chargé à la demande au premier résultat (aucun
 * poids sur le premier chargement des pages de connexion — décision D5). Purement DOM : le
 * bouton d'envoi du formulaire reçoit `data-done` (coche tracée, CSS) ou une secousse, puis
 * reprend son état ; vibration sémantique (Android).
 */
import { haptic } from "./haptics";
import type { FormState } from "../forms";

export function annoncer(ancre: HTMLElement | null, state: FormState) {
  const status = state.status;
  if (status !== "success" && status !== "error") return;
  const grave = status === "error" && state.code !== "VALIDATION_ERROR" && !state.legalGate;
  haptic(status === "success" ? "success" : grave ? "error" : "warning");
  if (document.documentElement.dataset.alive === "0") return;
  const form = ancre?.closest("form");
  const btn = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!btn) return;
  const attr = status === "success" ? "data-done" : "data-shake";
  btn.setAttribute(attr, "");
  window.setTimeout(() => btn.removeAttribute(attr), status === "success" ? 1100 : 520);
}
