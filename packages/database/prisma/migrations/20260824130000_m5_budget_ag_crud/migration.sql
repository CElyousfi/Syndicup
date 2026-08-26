-- ════════════════════════════════════════════════════════════════════════════
-- M5 — budget_ag : FK vers assemblee_generale (absente à la création de budget_ag en M5, avant
-- que M6 existe) + contrainte "1 seul budget ACTIF par (copropriete_id, exercice)".
--
-- ⚠️ LIMITE CONNUE, signalée (voir schema.prisma::BudgetAg) : l'enum StatutBudgetAg n'a pas de
-- 4e état "remplacé" — cet index empêche l'ambiguïté dans genererAppelDeFonds mais bloque aussi
-- toute révision d'un budget déjà ACTIF (Doc A §3.2 "budget rectificatif") tant que l'enum n'est
-- pas étendu par une décision produit explicite.
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX "budget_ag_ag_id_idx" ON "budget_ag"("ag_id");
ALTER TABLE "budget_ag" ADD CONSTRAINT "budget_ag_ag_id_fkey" FOREIGN KEY ("ag_id") REFERENCES "assemblee_generale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "budget_ag_actif_unique_par_exercice" ON "budget_ag"("copropriete_id", "exercice") WHERE "statut" = 'ACTIF';
