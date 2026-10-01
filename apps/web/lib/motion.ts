"use client";

/**
 * Jetons de mouvement côté JS — miroir de app/motion.css. À n'utiliser que dans des
 * composants client (îlots) ; les composants serveur s'animent par classes CSS.
 */
import { useEffect, useState } from "react";

export { useReducedMotion } from "motion/react";

/** Durées en secondes (convention motion). */
export const DUR = { fast: 0.12, base: 0.22, slow: 0.35, page: 0.32 } as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** Pression / relâchement : vif, à peine élastique. */
export const SPRING_PRESS = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
/** Indicateurs qui glissent d'un élément à l'autre (onglets, menu, pastille). */
export const SPRING_LAYOUT = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;

export const STAGGER = 0.045;

/** +1 en LTR, −1 en RTL — pour tout décalage horizontal piloté en JS. */
export function useDirSign(): 1 | -1 {
  const [sign, setSign] = useState<1 | -1>(1);
  useEffect(() => {
    setSign(document.documentElement.dir === "rtl" ? -1 : 1);
  }, []);
  return sign;
}
