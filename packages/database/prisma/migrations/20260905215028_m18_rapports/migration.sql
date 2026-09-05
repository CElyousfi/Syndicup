-- CreateEnum
CREATE TYPE "StatutRapportGestion" AS ENUM ('BROUILLON', 'GENERE', 'SOUMIS_AG', 'APPROUVE', 'REJETE');

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "factures_visibles_residents" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "rapport_gestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "exercice" TEXT NOT NULL,
    "budget_ag_id" UUID,
    "statut" "StatutRapportGestion" NOT NULL DEFAULT 'GENERE',
    "ag_id" UUID,
    "resolution_ag_id" UUID,
    "document_id" UUID,
    "donnees_json" JSONB NOT NULL,
    "genere_par_id" UUID NOT NULL,
    "genere_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rapport_gestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "filtres_json" JSONB,
    "nb_lignes" INTEGER NOT NULL,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rapport_gestion_copropriete_id_exercice_idx" ON "rapport_gestion"("copropriete_id", "exercice");

-- CreateIndex
CREATE INDEX "rapport_gestion_resolution_ag_id_idx" ON "rapport_gestion"("resolution_ag_id");

-- CreateIndex
CREATE INDEX "export_log_copropriete_id_horodatage_idx" ON "export_log"("copropriete_id", "horodatage");

-- CreateIndex
CREATE INDEX "export_log_utilisateur_id_idx" ON "export_log"("utilisateur_id");

-- AddForeignKey
ALTER TABLE "rapport_gestion" ADD CONSTRAINT "rapport_gestion_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_gestion" ADD CONSTRAINT "rapport_gestion_budget_ag_id_fkey" FOREIGN KEY ("budget_ag_id") REFERENCES "budget_ag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_gestion" ADD CONSTRAINT "rapport_gestion_ag_id_fkey" FOREIGN KEY ("ag_id") REFERENCES "assemblee_generale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_gestion" ADD CONSTRAINT "rapport_gestion_resolution_ag_id_fkey" FOREIGN KEY ("resolution_ag_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_gestion" ADD CONSTRAINT "rapport_gestion_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rapport_gestion" ADD CONSTRAINT "rapport_gestion_genere_par_id_fkey" FOREIGN KEY ("genere_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_log" ADD CONSTRAINT "export_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_log" ADD CONSTRAINT "export_log_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- M18 — RAPPORTS : contraintes, RLS
-- Doc A §8 (reddition des comptes), §6 (approbation des comptes en AG), §3.5 (transparence).
-- rapport_gestion : lu / écrit par le syndic et le conseil syndical uniquement (les chiffres
-- agrégés exposés aux résidents passent par GET /rapports/transparence, calculé sans données
-- par lot). export_log : append-only (SELECT syndic / conseil ; INSERT par l'auteur de l'export,
-- quel que soit son rôle — un propriétaire qui télécharge le relevé PDF de son lot est tracé).
-- ════════════════════════════════════════════════════════════════════════════

-- Exercice « YYYY » ; un seul rapport vivant (non REJETE) par copropriété et exercice.
ALTER TABLE "rapport_gestion"
  ADD CONSTRAINT rapport_gestion_exercice_format CHECK (exercice ~ '^[0-9]{4}$');
CREATE UNIQUE INDEX rapport_gestion_copro_exercice_actif
  ON "rapport_gestion" (copropriete_id, exercice) WHERE statut <> 'REJETE';

ALTER TABLE "export_log"
  ADD CONSTRAINT export_log_nb_lignes_positif CHECK (nb_lignes >= 0);

GRANT SELECT, INSERT, UPDATE ON "rapport_gestion" TO application_role;
GRANT SELECT, INSERT ON "export_log" TO application_role;

ALTER TABLE "rapport_gestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rapport_gestion" FORCE ROW LEVEL SECURITY;
ALTER TABLE "export_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "export_log" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "rapport_gestion"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

CREATE POLICY tenant_isolation ON "export_log"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );
CREATE POLICY tenant_insert ON "export_log"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
