import { defineConfig } from "vitest/config";

/** Tests unitaires du web — fonctions pures (vocabulaire d'erreurs, chargements, issues de page). */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
