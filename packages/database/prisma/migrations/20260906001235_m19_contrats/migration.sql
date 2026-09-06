-- CreateEnum
CREATE TYPE "TypeContrat" AS ENUM ('ASSURANCE_IMMEUBLE', 'ASSURANCE_RC', 'ASCENSEUR', 'NETTOYAGE', 'GARDIENNAGE', 'JARDINAGE', 'DERATISATION', 'EAU', 'ELECTRICITE', 'INTERNET', 'SYNDIC_PROFESSIONNEL', 'TRAVAUX', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutContrat" AS ENUM ('BROUILLON', 'ACTIF', 'SUSPENDU', 'RESILIE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "Periodicite" AS ENUM ('MENSUELLE', 'TRIMESTRIELLE', 'SEMESTRIELLE', 'ANNUELLE', 'PONCTUELLE');

-- CreateEnum
CREATE TYPE "TypeEcheance" AS ENUM ('PAIEMENT', 'RENOUVELLEMENT', 'VISITE_TECHNIQUE', 'CONTROLE_REGLEMENTAIRE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutEcheanceContrat" AS ENUM ('A_VENIR', 'DEPENSE_GENEREE', 'REALISEE', 'MANQUEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeContratLog" AS ENUM ('CREE', 'MODIFIE', 'ACTIVE', 'SUSPENDU', 'RESILIE', 'EXPIRE', 'RECONDUIT', 'ECHEANCES_GENEREES', 'DEPENSE_GENEREE', 'ECHEANCE_MODIFIEE', 'DOCUMENT_AJOUTE');

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "assurance_alerte_envoyee_le" TIMESTAMPTZ,
ADD COLUMN     "seuil_contrat_ag" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "contrat" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "prestataire_id" UUID,
    "type" "TypeContrat" NOT NULL,
    "libelle" TEXT NOT NULL,
    "reference" TEXT,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "tacite" BOOLEAN NOT NULL DEFAULT false,
    "preavis_jours" INTEGER,
    "periodicite" "Periodicite" NOT NULL,
    "montant_periode" DECIMAL(14,2),
    "budget_poste_id" UUID,
    "statut" "StatutContrat" NOT NULL DEFAULT 'BROUILLON',
    "document_id" UUID,
    "attestation_document_id" UUID,
    "details_assurance_json" JSONB,
    "resolution_ag_id" UUID,
    "notes" TEXT,
    "motif_resiliation" TEXT,
    "date_resiliation" DATE,
    "cree_par_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrat_echeance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contrat_id" UUID NOT NULL,
    "type" "TypeEcheance" NOT NULL,
    "date_echeance" DATE NOT NULL,
    "montant" DECIMAL(14,2),
    "statut" "StatutEcheanceContrat" NOT NULL DEFAULT 'A_VENIR',
    "depense_id" UUID,
    "tache_id" UUID,
    "notifie_j30_le" TIMESTAMPTZ,
    "notifie_j7_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contrat_echeance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrat_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "contrat_id" UUID NOT NULL,
    "type" "TypeContratLog" NOT NULL,
    "acteur_id" UUID,
    "details_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrat_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contrat_copropriete_id_statut_idx" ON "contrat"("copropriete_id", "statut");

-- CreateIndex
CREATE INDEX "contrat_copropriete_id_type_idx" ON "contrat"("copropriete_id", "type");

-- CreateIndex
CREATE INDEX "contrat_prestataire_id_idx" ON "contrat"("prestataire_id");

-- CreateIndex
CREATE INDEX "contrat_date_fin_idx" ON "contrat"("date_fin");

-- CreateIndex
CREATE INDEX "contrat_echeance_contrat_id_statut_idx" ON "contrat_echeance"("contrat_id", "statut");

-- CreateIndex
CREATE INDEX "contrat_echeance_date_echeance_idx" ON "contrat_echeance"("date_echeance");

-- CreateIndex
CREATE UNIQUE INDEX "contrat_echeance_contrat_id_type_date_echeance_key" ON "contrat_echeance"("contrat_id", "type", "date_echeance");

-- CreateIndex
CREATE INDEX "contrat_log_contrat_id_horodatage_idx" ON "contrat_log"("contrat_id", "horodatage");

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_prestataire_id_fkey" FOREIGN KEY ("prestataire_id") REFERENCES "prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_budget_poste_id_fkey" FOREIGN KEY ("budget_poste_id") REFERENCES "budget_poste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_attestation_document_id_fkey" FOREIGN KEY ("attestation_document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_resolution_ag_id_fkey" FOREIGN KEY ("resolution_ag_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat" ADD CONSTRAINT "contrat_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_echeance" ADD CONSTRAINT "contrat_echeance_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_echeance" ADD CONSTRAINT "contrat_echeance_depense_id_fkey" FOREIGN KEY ("depense_id") REFERENCES "depense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_log" ADD CONSTRAINT "contrat_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_log" ADD CONSTRAINT "contrat_log_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_log" ADD CONSTRAINT "contrat_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- M19 — CONTRATS : contraintes, fonctions, RLS
-- Doc A §7 / §8 : les contrats prestataires et l'assurance sont des documents « syndic_only /
-- conseil » (§12.3) — lecture et écriture syndic + conseil syndical uniquement ; aucun résident,
-- gardien ni prestataire. contrat_log : append-only (SELECT + INSERT).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "contrat"
  ADD CONSTRAINT contrat_dates_coherentes CHECK (date_fin IS NULL OR date_fin >= date_debut),
  ADD CONSTRAINT contrat_montant_non_negatif CHECK (montant_periode IS NULL OR montant_periode >= 0),
  ADD CONSTRAINT contrat_preavis_non_negatif CHECK (preavis_jours IS NULL OR preavis_jours >= 0),
  ADD CONSTRAINT contrat_resiliation_coherente CHECK (statut <> 'RESILIE' OR motif_resiliation IS NOT NULL);
ALTER TABLE "contrat_echeance"
  ADD CONSTRAINT contrat_echeance_montant_non_negatif CHECK (montant IS NULL OR montant >= 0);
ALTER TABLE "copropriete"
  ADD CONSTRAINT copropriete_seuil_contrat_ag_non_negatif CHECK (seuil_contrat_ag IS NULL OR seuil_contrat_ag >= 0);

CREATE OR REPLACE FUNCTION public.contrat_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "contrat" WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.contrat_copropriete_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contrat_copropriete_id(uuid) TO application_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON "contrat", "contrat_echeance" TO application_role;
GRANT SELECT, INSERT ON "contrat_log" TO application_role;

ALTER TABLE "contrat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contrat" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contrat_echeance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contrat_echeance" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contrat_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contrat_log" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "contrat"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

CREATE POLICY tenant_isolation ON "contrat_echeance"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.contrat_copropriete_id(contrat_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

CREATE POLICY tenant_isolation ON "contrat_log"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );
CREATE POLICY tenant_insert ON "contrat_log"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND public.contrat_copropriete_id(contrat_id) = copropriete_id
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );
