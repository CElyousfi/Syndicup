"use client";

/**
 * Jetons de mouvement côté JS — générés depuis packages/config/motion/tokens.json (voir
 * lib/motion-tokens.ts). À n'utiliser que dans des composants client (îlots) ; les composants
 * serveur s'animent par classes CSS.
 */
import { useEffect, useState } from "react";
import { SPRING_SNAPPY, SPRING_SMOOTH } from "./motion-tokens";

export { useReducedMotion } from "motion/react";
export {
  DUR,
  DURATIONS_MS,
  STAGGER,
  MAX_STAGGER,
  DISTANCES,
  PRESS_SCALE,
  EASE_OUT,
  EASE_IN,
  EASE_SPRING,
  SPRING_SNAPPY,
  SPRING_SMOOTH,
  SPRING_GENTLE,
} from "./motion-tokens";

/** Pression / relâchement : vif, à peine élastique (= SPRING_SNAPPY). */
export const SPRING_PRESS = SPRING_SNAPPY;
/** Indicateurs qui glissent d'un élément à l'autre (onglets, menu, pastille) (= SPRING_SMOOTH). */
export const SPRING_LAYOUT = SPRING_SMOOTH;

/** +1 en LTR, −1 en RTL — pour tout décalage horizontal piloté en JS. */
export function useDirSign(): 1 | -1 {
  const [sign, setSign] = useState<1 | -1>(1);
  useEffect(() => {
    setSign(document.documentElement.dir === "rtl" ? -1 : 1);
  }, []);
  return sign;
}
