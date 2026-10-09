/* GÉNÉRÉ par packages/config/motion/gen.mjs depuis tokens.json — ne pas modifier à la main. */

/** Durées en millisecondes. */
export const DURATIONS_MS = {
  "press": 100,
  "toggle": 120,
  "release": 360,
  "fast": 180,
  "base": 260,
  "page": 320,
  "slow": 400,
  "sheetIn": 400,
  "sheetOut": 260,
  "number": 900,
  "highlight": 1200,
  "signature": 700,
  "signatureMax": 1200
} as const;

/** Durées en secondes (convention `motion`). */
export const DUR = {
  "press": 0.1,
  "toggle": 0.12,
  "release": 0.36,
  "fast": 0.18,
  "base": 0.26,
  "page": 0.32,
  "slow": 0.4,
  "sheetIn": 0.4,
  "sheetOut": 0.26,
  "number": 0.9,
  "highlight": 1.2,
  "signature": 0.7,
  "signatureMax": 1.2
} as const;

export const STAGGER = 0.035;
export const MAX_STAGGER = 8;
export const DISTANCES = {"xs":8,"sm":16,"md":24} as const;
export const PRESS_SCALE = {"button":0.965,"card":0.98,"row":0.985,"chip":0.94,"icon":0.9} as const;
export const EASE_OUT = [0.22,1,0.36,1] as const;
export const EASE_IN = [0.4,0,1,1] as const;
export const EASE_SPRING = [0.34,1.56,0.64,1] as const;
export const SPRING_SNAPPY = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;
export const SPRING_SMOOTH = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;
export const SPRING_GENTLE = { type: "spring", stiffness: 180, damping: 22, mass: 1 } as const;
export const HAPTIC_THROTTLE_MS = 80;
