import { defineConfig } from "vitest/config";

/** Tests unitaires du web — fonctions pures (vocabulaire d'erreurs, chargements, issues de page). */
export default defineConfig({
  // tsconfig garde `jsx: preserve` (Next) : vitest transforme lui-même le JSX (runtime automatique).
  oxc: { jsx: { runtime: "automatic" } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["lib/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
