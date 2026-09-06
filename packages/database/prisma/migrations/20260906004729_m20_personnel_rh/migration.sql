-- CreateEnum
CREATE TYPE "PostePersonnel" AS ENUM ('GARDIEN', 'AGENT_ENTRETIEN', 'JARDINIER', 'AGENT_SECURITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeContratTravail" AS ENUM ('CDI', 'CDD', 'ANAPEC', 'STAGE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutFichePaie" AS ENUM ('BROUILLON', 'VALIDEE', 'PAYEE');

-- CreateEnum
CREATE TYPE "TypeConge" AS ENUM ('ANNUEL', 'MALADIE', 'SANS_SOLDE', 'EXCEPTIONNEL');

-- CreateEnum
CREATE TYPE "StatutConge" AS ENUM ('DEMANDE', 'APPROUVE', 'REFUSE', 'ANNULE');

-- CreateEnum
CREATE TYPE "StatutPresence" AS ENUM ('PRESENT', 'ABSENT', 'CONGE', 'MALADIE');

-- CreateEnum
CREATE TYPE "TypePersonnelLog" AS ENUM ('FICHE_CREEE', 'FICHE_MODIFIEE', 'STATUT_CHANGE', 'CNSS_CONSULTE', 'PAIE_BROUILLON', 'PAIE_VALIDEE', 'PAIE_PAYEE', 'CONGE_DEMANDE', 'CONGE_APPROUVE', 'CONGE_REFUSE', 'CONGE_ANNULE', 'PRESENCE_SAISIE', 'EVALUATION', 'DOCUMENT_AJOUTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatutPersonnel" ADD VALUE 'PRE_EMBAUCHE';
ALTER TYPE "StatutPersonnel" ADD VALUE 'PARTI';

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "parametres_paie_json" JSONB;

-- AlterTable
ALTER TABLE "personnel" ADD COLUMN     "contact_urgence" TEXT,
ADD COLUMN     "date_embauche" DATE,
ADD COLUMN     "date_fin_contrat" DATE,
ADD COLUMN     "document_contrat_id" UUID,
ADD COLUMN     "fin_contrat_notifie_le" TIMESTAMPTZ,
ADD COLUMN     "horaires_json" JSONB,
ADD COLUMN     "modifie_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "numero_cnss" TEXT,
ADD COLUMN     "poste" "PostePersonnel" NOT NULL DEFAULT 'GARDIEN',
ADD COLUMN     "salaire_brut_mensuel" DECIMAL(14,2),
ADD COLUMN     "type_contrat" "TypeContratTravail";

-- CreateTable
CREATE TABLE "fiche_paie" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "periode" TEXT NOT NULL,
    "brut" DECIMAL(14,2) NOT NULL,
    "primes" DECIMAL(14,2),
    "retenues" DECIMAL(14,2),
    "cotisations_salariales_json" JSONB NOT NULL,
    "cotisations_patronales_json" JSONB NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "cout_total_employeur" DECIMAL(14,2) NOT NULL,
    "details_json" JSONB,
    "statut" "StatutFichePaie" NOT NULL DEFAULT 'BROUILLON',
    "depense_id" UUID,
    "document_id" UUID,
    "valide_par_id" UUID,
    "valide_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fiche_paie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "type" "TypeConge" NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "nb_jours" DECIMAL(5,1) NOT NULL,
    "statut" "StatutConge" NOT NULL DEFAULT 'DEMANDE',
    "traite_par_id" UUID,
    "traite_le" TIMESTAMPTZ,
    "motif" TEXT,
    "motif_refus" TEXT,
    "document_id" UUID,
    "remplacant_personnel_id" UUID,
    "rappel_envoye_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_personnel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "periode" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "evaluateur_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_personnel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "statut" "StatutPresence" NOT NULL,
    "commentaire" TEXT,
    "saisi_par_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "presence_personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personnel_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "type" "TypePersonnelLog" NOT NULL,
    "acteur_id" UUID,
    "details_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiche_paie_depense_id_key" ON "fiche_paie"("depense_id");

-- CreateIndex
CREATE INDEX "fiche_paie_copropriete_id_periode_idx" ON "fiche_paie"("copropriete_id", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "fiche_paie_personnel_id_periode_key" ON "fiche_paie"("personnel_id", "periode");

-- CreateIndex
CREATE INDEX "conge_copropriete_id_statut_idx" ON "conge"("copropriete_id", "statut");

-- CreateIndex
CREATE INDEX "conge_personnel_id_date_debut_idx" ON "conge"("personnel_id", "date_debut");

-- CreateIndex
CREATE INDEX "evaluation_personnel_personnel_id_idx" ON "evaluation_personnel"("personnel_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_personnel_personnel_id_periode_evaluateur_id_key" ON "evaluation_personnel"("personnel_id", "periode", "evaluateur_id");

-- CreateIndex
CREATE INDEX "presence_personnel_copropriete_id_date_idx" ON "presence_personnel"("copropriete_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "presence_personnel_personnel_id_date_key" ON "presence_personnel"("personnel_id", "date");

-- CreateIndex
CREATE INDEX "personnel_log_personnel_id_horodatage_idx" ON "personnel_log"("personnel_id", "horodatage");

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_document_contrat_id_fkey" FOREIGN KEY ("document_contrat_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche_paie" ADD CONSTRAINT "fiche_paie_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche_paie" ADD CONSTRAINT "fiche_paie_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche_paie" ADD CONSTRAINT "fiche_paie_depense_id_fkey" FOREIGN KEY ("depense_id") REFERENCES "depense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche_paie" ADD CONSTRAINT "fiche_paie_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiche_paie" ADD CONSTRAINT "fiche_paie_valide_par_id_fkey" FOREIGN KEY ("valide_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conge" ADD CONSTRAINT "conge_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conge" ADD CONSTRAINT "conge_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conge" ADD CONSTRAINT "conge_traite_par_id_fkey" FOREIGN KEY ("traite_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conge" ADD CONSTRAINT "conge_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conge" ADD CONSTRAINT "conge_remplacant_personnel_id_fkey" FOREIGN KEY ("remplacant_personnel_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_personnel" ADD CONSTRAINT "evaluation_personnel_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_personnel" ADD CONSTRAINT "evaluation_personnel_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_personnel" ADD CONSTRAINT "evaluation_personnel_evaluateur_id_fkey" FOREIGN KEY ("evaluateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_personnel" ADD CONSTRAINT "presence_personnel_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_personnel" ADD CONSTRAINT "presence_personnel_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_personnel" ADD CONSTRAINT "presence_personnel_saisi_par_id_fkey" FOREIGN KEY ("saisi_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_log" ADD CONSTRAINT "personnel_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_log" ADD CONSTRAINT "personnel_log_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_log" ADD CONSTRAINT "personnel_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- M20 — PERSONNEL RH : contraintes, fonctions, RLS
-- Doc A §9 : la fiche personnel (présence, logement) reste lisible de toute la copropriété (fiche
-- d'urgence — policy `personnel` inchangée) ; les données RH (paie, congés, présences, évaluations,
-- journal) ne sont visibles que du syndic et de l'employé concerné. Le conseil syndical évalue
-- (evaluation_personnel) et lit les congés / présences (planning). Aucun résident, prestataire ou
-- gestionnaire LCD. personnel_log : append-only (SELECT + INSERT).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "personnel"
  ADD CONSTRAINT personnel_salaire_non_negatif CHECK (salaire_brut_mensuel IS NULL OR salaire_brut_mensuel >= 0),
  ADD CONSTRAINT personnel_dates_contrat CHECK (date_fin_contrat IS NULL OR date_embauche IS NULL OR date_fin_contrat >= date_embauche);
ALTER TABLE "fiche_paie"
  ADD CONSTRAINT fiche_paie_periode_format CHECK (periode ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT fiche_paie_montants CHECK (brut >= 0 AND net >= 0 AND cout_total_employeur >= 0);
ALTER TABLE "conge"
  ADD CONSTRAINT conge_dates CHECK (date_fin >= date_debut),
  ADD CONSTRAINT conge_nb_jours CHECK (nb_jours > 0),
  ADD CONSTRAINT conge_refus_motif CHECK (statut <> 'REFUSE' OR motif_refus IS NOT NULL);
ALTER TABLE "evaluation_personnel"
  ADD CONSTRAINT evaluation_note CHECK (note BETWEEN 1 AND 5);

-- Employé propriétaire d'une fiche personnel (pour les policies « ses propres données »).
CREATE OR REPLACE FUNCTION public.personnel_utilisateur_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT utilisateur_id FROM "personnel" WHERE id = p_id;
$$;
CREATE OR REPLACE FUNCTION public.personnel_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "personnel" WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.personnel_utilisateur_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.personnel_copropriete_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.personnel_utilisateur_id(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.personnel_copropriete_id(uuid) TO application_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON "fiche_paie", "conge", "evaluation_personnel", "presence_personnel" TO application_role;
GRANT SELECT, INSERT ON "personnel_log" TO application_role;

ALTER TABLE "fiche_paie" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiche_paie" FORCE ROW LEVEL SECURITY;
ALTER TABLE "conge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conge" FORCE ROW LEVEL SECURITY;
ALTER TABLE "evaluation_personnel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluation_personnel" FORCE ROW LEVEL SECURITY;
ALTER TABLE "presence_personnel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "presence_personnel" FORCE ROW LEVEL SECURITY;
ALTER TABLE "personnel_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personnel_log" FORCE ROW LEVEL SECURITY;

-- fiche_paie : syndic tout ; l'employé lit les siennes (jamais celles d'un collègue).
CREATE POLICY tenant_isolation ON "fiche_paie"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) = 'SYNDIC'
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) = 'SYNDIC'
    )
  );

-- conge : syndic tout ; conseil lecture (planning) ; l'employé lit et crée (demande) / annule les siens.
CREATE POLICY tenant_isolation ON "conge"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) = 'SYNDIC'
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

-- evaluation_personnel : syndic + conseil (évaluateurs) ; jamais l'employé ni un résident.
CREATE POLICY tenant_isolation ON "evaluation_personnel"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

-- presence_personnel : syndic tout ; conseil lecture ; l'employé lit et pointe (INSERT / UPDATE) les siennes.
CREATE POLICY tenant_isolation ON "presence_personnel"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) = 'SYNDIC'
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

-- personnel_log : append-only ; syndic lit tout, l'employé lit son propre journal ; INSERT par le
-- syndic, l'évaluateur (conseil) ou l'employé pour ses propres gestes (demande de congé, pointage).
CREATE POLICY tenant_isolation ON "personnel_log"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) = 'SYNDIC'
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
CREATE POLICY tenant_insert ON "personnel_log"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND public.personnel_copropriete_id(personnel_id) = copropriete_id
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR public.personnel_utilisateur_id(personnel_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
