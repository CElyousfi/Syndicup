// Config ESLint partagée (flat config). Chaque app l'étend et ajoute ses règles spécifiques
// (ex. règles Next.js dans apps/web, apps/api).
//
// Règle notable : `no-restricted-syntax` sur Math avec des littéraux financiers est volontairement
// ABSENTE ici — une règle ESLint ne peut pas fiablement distinguer un calcul monétaire d'un
// calcul non-monétaire par l'AST seul. Le garde-fou réel reste la revue de code humaine sur la
// checklist CLAUDE.md §4 ("Pas de valeur monétaire manipulée en dehors de lib/money") — ne pas
// se reposer sur le lint pour cette règle non négociable.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Rappel CLAUDE.md §5 : pas de console.log de production non structuré — ce warn est un
      // filet de sécurité, pas un substitut au logger structuré JSON attendu en prod.
    },
  },
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/*.generated.ts"],
  }
);
