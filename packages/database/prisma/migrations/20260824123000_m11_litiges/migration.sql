-- ════════════════════════════════════════════════════════════════════════════
-- M11 — LITIGES (Master Spec Partie 2.2, Doc A §12.1)
--
-- ⚠️ LEGAL_QUESTIONS_BRIEF.md §0 : une étape de conciliation préalable obligatoire (Loi 30-24)
-- pourrait devoir s'insérer avant le niveau tribunal — non modélisée tant que non confirmée.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE "StatutLitige" AS ENUM ('OUVERT', 'RESOLU', 'CLOS');

-- CreateTable
CREATE TABLE "conflit_litige" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutLitige" NOT NULL DEFAULT 'OUVERT',
    "escalade_niveau" INTEGER NOT NULL DEFAULT 0,
    "cree_par" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "conflit_litige_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conflit_litige_copropriete_id_idx" ON "conflit_litige"("copropriete_id");
ALTER TABLE "conflit_litige" ADD CONSTRAINT "conflit_litige_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conflit_litige" ADD CONSTRAINT "conflit_litige_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Workflow Doc A §12.1 : 0 = traitement syndic, 1 = médiation AG, 2 = tribunal.
ALTER TABLE "conflit_litige" ADD CONSTRAINT "conflit_litige_escalade_niveau_check"
  CHECK ("escalade_niveau" BETWEEN 0 AND 2);

GRANT SELECT, INSERT, UPDATE, DELETE ON "conflit_litige" TO application_role;

ALTER TABLE "conflit_litige" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conflit_litige" FORCE ROW LEVEL SECURITY;

-- Confidentialité (Doc A §12.3) : un litige est une affaire entre son porteur et la gestion —
-- syndic/conseil syndical voient tout dans leur copropriété, les autres rôles ne voient que les
-- litiges qu'ils ont eux-mêmes déclarés.
CREATE POLICY tenant_isolation ON "conflit_litige"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR cree_par = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR cree_par = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
