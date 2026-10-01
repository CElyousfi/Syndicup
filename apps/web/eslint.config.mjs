import base from "@copropriete-maroc/config/eslint";

/**
 * `motion` (~46 kB gz) n'est chargé que par la coque de l'espace connecté. Ce garde-fou empêche
 * qu'un composant partagé l'importe et l'embarque dans les pages publiques (connexion, OTP) :
 * seuls components/shell/** et lib/motion* y ont droit. Les autres animations passent par CSS.
 */
const MOTION_RESTRICT = {
  paths: [
    { name: "motion", message: "Réservé à la coque (components/shell) — utiliser les classes de app/motion.css." },
    { name: "motion/react", message: "Réservé à la coque (components/shell) — utiliser les classes de app/motion.css." },
    { name: "framer-motion", message: "Utiliser `motion` (et seulement dans components/shell)." },
  ],
  patterns: [
    { group: ["**/lib/motion", "**/lib/motion-features"], message: "Ré-exporte `motion` : réservé à components/shell." },
  ],
};

export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/shell/**", "lib/motion.ts", "lib/motion-features.ts"],
    rules: { "no-restricted-imports": ["error", MOTION_RESTRICT] },
  },
];
