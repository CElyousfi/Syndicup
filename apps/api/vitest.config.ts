import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests d'intégration contre le Supabase local (npx supabase start) — pas de mocks DB.
    setupFiles: ["./tests/setup-env.ts"],
    // Les tests RLS partagent des lignes seedées — exécution séquentielle pour rester déterministe.
    fileParallelism: false,
  },
});
