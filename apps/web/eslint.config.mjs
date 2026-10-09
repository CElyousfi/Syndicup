import base from "@copropriete-maroc/config/eslint";

/**
 * `motion` (~46 kB gz) n'entre jamais dans les pages publiques (connexion, OTP, invitation) :
 * leur poids JS est mesuré à chaque phase Alive et ne doit pas grossir (décision D5).
 *  - autorisé : components/shell/** (coque connectée), components/ui/** (primitives partagées,
 *    utilisées par l'espace connecté), lib/motion* ;
 *  - interdit : tout le reste (pages, composants métier) — on passe par les classes de
 *    app/motion.css ou par une primitive de components/ui ;
 *  - les pages publiques et components/auth n'importent en plus AUCUNE primitive qui l'embarque
 *    (liste MOTION_UI ci-dessous, à tenir à jour si une primitive ui/ importe `motion`).
 */
const MOTION_PATHS = [
  { name: "motion", message: "Réservé à components/shell et components/ui — utiliser une primitive ou app/motion.css." },
  { name: "motion/react", message: "Réservé à components/shell et components/ui — utiliser une primitive ou app/motion.css." },
  { name: "framer-motion", message: "Utiliser `motion` (et seulement dans components/shell ou components/ui)." },
];
const MOTION_PATTERNS = [
  { group: ["**/lib/motion", "**/lib/motion-features"], message: "Ré-exporte `motion` : réservé à components/shell et components/ui." },
  // Le lecteur Lottie n'est chargé qu'à la demande, par un seul module (jamais au premier chargement).
  { group: ["lottie-web", "lottie-web/*"], message: "Passer par lib/feel/lottie-art (chargé paresseusement, illustrations animées)." },
];
/** Primitives ui/ qui importent `motion` — interdites dans les pages publiques. */
const MOTION_UI = [];

export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/shell/**", "components/ui/**", "lib/motion.ts", "lib/motion-features.ts", "lib/feel/lottie-art.ts"],
    rules: { "no-restricted-imports": ["error", { paths: MOTION_PATHS, patterns: MOTION_PATTERNS }] },
  },
  {
    files: ["app/[[]locale[]]/(public)/**/*.{ts,tsx}", "components/auth/**/*.{ts,tsx}", "app/[[]locale[]]/page.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: MOTION_PATHS,
          patterns: [
            ...MOTION_PATTERNS,
            ...(MOTION_UI.length ? [{ group: MOTION_UI, message: "Cette primitive embarque `motion` : interdite dans les pages publiques (D5)." }] : []),
          ],
        },
      ],
    },
  },
];
