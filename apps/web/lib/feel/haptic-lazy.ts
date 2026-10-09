/**
 * Haptique chargée À LA DEMANDE : les primitives présentes sur les pages publiques (formulaires,
 * cases) n'embarquent pas le module de réglages dans leur premier chargement JS (décision D5 :
 * le poids des pages de connexion ne grossit pas). La vibration part au premier geste suivant.
 */
import type { HapticIntent } from "./haptics";

export function hapticLazy(intent: HapticIntent) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  void import("./lazy").then((m) => m.haptic(intent));
}
