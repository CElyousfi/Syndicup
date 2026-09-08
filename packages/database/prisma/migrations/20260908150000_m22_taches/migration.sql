-- CreateEnum
CREATE TYPE "OrigineTache" AS ENUM ('MANUELLE', 'RESOLUTION_AG', 'CONTRAT', 'INCIDENT', 'RAPPORT', 'SYSTEME');

-- CreateEnum
CREATE TYPE "PrioriteTache" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('A_FAIRE', 'EN_COURS', 'BLOQUEE', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "TypeTacheLog" AS ENUM ('CREEE', 'MODIFIEE', 'STATUT_CHANGE', 'ASSIGNEE', 'CHECKLIST', 'COMMENTAIRE', 'DOCUMENT_AJOUTE', 'RECURRENCE', 'RAPPEL');

-- AlterTable
ALTER TABLE "ag_resolution" ADD COLUMN     "necessite_execution" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "delai_execution_resolution_jours" INTEGER;

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "tache_id" UUID;

-- CreateTable
CREATE TABLE "tache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "origine" "OrigineTache" NOT NULL DEFAULT 'MANUELLE',
    "resolution_ag_id" UUID,
    "incident_id" UUID,
    "rapport_gestion_id" UUID,
    "assignee_id" UUID,
    "priorite" "PrioriteTache" NOT NULL DEFAULT 'NORMALE',
    "statut" "StatutTache" NOT NULL DEFAULT 'A_FAIRE',
    "date_echeance" DATE,
    "terminee_le" TIMESTAMPTZ,
    "checklist_json" JSONB,
    "recurrence_json" JSONB,
    "recurrence_parente_id" UUID,
    "visible_conseil" BOOLEAN NOT NULL DEFAULT true,
    "cree_par_id" UUID,
    "rappel_j3_le" TIMESTAMPTZ,
    "rappel_j0_le" TIMESTAMPTZ,
    "rappel_retard_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tache_commentaire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tache_id" UUID NOT NULL,
    "auteur_id" UUID NOT NULL,
    "contenu" TEXT NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tache_commentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tache_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "tache_id" UUID NOT NULL,
    "type" "TypeTacheLog" NOT NULL,
    "acteur_id" UUID,
    "details_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tache_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tache_copropriete_id_statut_date_echeance_idx" ON "tache"("copropriete_id", "statut", "date_echeance");

-- CreateIndex
CREATE INDEX "tache_assignee_id_statut_idx" ON "tache"("assignee_id", "statut");

-- CreateIndex
CREATE INDEX "tache_resolution_ag_id_idx" ON "tache"("resolution_ag_id");

-- CreateIndex
CREATE INDEX "tache_incident_id_idx" ON "tache"("incident_id");

-- CreateIndex
CREATE INDEX "tache_commentaire_tache_id_cree_le_idx" ON "tache_commentaire"("tache_id", "cree_le");

-- CreateIndex
CREATE INDEX "tache_log_tache_id_horodatage_idx" ON "tache_log"("tache_id", "horodatage");

-- CreateIndex
CREATE UNIQUE INDEX "contrat_echeance_tache_id_key" ON "contrat_echeance"("tache_id");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "tache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrat_echeance" ADD CONSTRAINT "contrat_echeance_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "tache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache" ADD CONSTRAINT "tache_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache" ADD CONSTRAINT "tache_resolution_ag_id_fkey" FOREIGN KEY ("resolution_ag_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache" ADD CONSTRAINT "tache_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache" ADD CONSTRAINT "tache_rapport_gestion_id_fkey" FOREIGN KEY ("rapport_gestion_id") REFERENCES "rapport_gestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache" ADD CONSTRAINT "tache_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache" ADD CONSTRAINT "tache_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_commentaire" ADD CONSTRAINT "tache_commentaire_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "tache"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_commentaire" ADD CONSTRAINT "tache_commentaire_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_log" ADD CONSTRAINT "tache_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_log" ADD CONSTRAINT "tache_log_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "tache"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_log" ADD CONSTRAINT "tache_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- M22 — TÂCHES : contraintes, fonctions (SECURITY DEFINER), RLS.
-- Lecture : syndic tout ; conseil si visible_conseil ; assigné(e) ses propres tâches.
-- Écriture : syndic ; l'assigné(e) met à jour ses propres tâches (statut / checklist — borné en code).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "tache"
  ADD CONSTRAINT tache_titre_check CHECK (char_length(titre) BETWEEN 1 AND 200),
  ADD CONSTRAINT tache_terminee_check CHECK (statut <> 'TERMINEE' OR terminee_le IS NOT NULL),
  ADD CONSTRAINT tache_checklist_check CHECK (checklist_json IS NULL OR jsonb_typeof(checklist_json) = 'array'),
  ADD CONSTRAINT tache_recurrence_check CHECK (recurrence_json IS NULL OR jsonb_typeof(recurrence_json) = 'object');
ALTER TABLE "tache_commentaire"
  ADD CONSTRAINT tache_commentaire_contenu_check CHECK (char_length(contenu) BETWEEN 1 AND 4000);
ALTER TABLE "copropriete"
  ADD CONSTRAINT copropriete_delai_execution_check CHECK (delai_execution_resolution_jours IS NULL OR delai_execution_resolution_jours BETWEEN 1 AND 730);

CREATE OR REPLACE FUNCTION public.tache_copropriete_id(p_tache_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "tache" WHERE id = p_tache_id;
$$;

-- La tâche est-elle visible de l'utilisateur courant (tenant + rôle + assignation) ?
CREATE OR REPLACE FUNCTION public.tache_visible(p_tache_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "tache" t
    WHERE t.id = p_tache_id
      AND t.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SUPER_ADMIN', 'SYNDIC')
        OR (current_setting('app.current_role', true) = 'CONSEIL_SYNDICAL' AND t.visible_conseil)
        OR t.assignee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
  );
$$;

-- Suivi d'exécution d'une résolution d'AG pour tout membre voyant l'AG (copropriétaires) :
-- uniquement le titre, le statut et les dates de la tâche liée — jamais les commentaires ni l'assigné.
CREATE OR REPLACE FUNCTION public.resolution_execution(p_resolution_id uuid)
RETURNS TABLE (tache_id uuid, titre text, statut "StatutTache", date_echeance date, terminee_le timestamptz, cree_le timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT t.id, t.titre, t.statut, t.date_echeance, t.terminee_le, t.cree_le
  FROM "tache" t
  JOIN "ag_resolution" r ON r.id = t.resolution_ag_id
  JOIN "assemblee_generale" ag ON ag.id = r.ag_id
  WHERE t.resolution_ag_id = p_resolution_id
    AND ag.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    AND NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "role_utilisateur" ru
      WHERE ru.utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        AND ru.copropriete_id = ag.copropriete_id AND ru.actif
    )
  ORDER BY t.cree_le ASC;
$$;

REVOKE ALL ON FUNCTION public.tache_copropriete_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tache_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolution_execution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tache_copropriete_id(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.tache_visible(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.resolution_execution(uuid) TO application_role;

GRANT SELECT, INSERT, UPDATE ON "tache" TO application_role;
GRANT SELECT, INSERT ON "tache_commentaire", "tache_log" TO application_role;

ALTER TABLE "tache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tache" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tache_commentaire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tache_commentaire" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tache_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tache_log" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON "tache" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) = 'SYNDIC'
        OR (current_setting('app.current_role', true) = 'CONSEIL_SYNDICAL' AND visible_conseil)
        OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
CREATE POLICY tenant_insert ON "tache" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) = 'SYNDIC')
  );
CREATE POLICY tenant_update ON "tache" FOR UPDATE
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) = 'SYNDIC'
             OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) = 'SYNDIC'
             OR assignee_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  );

CREATE POLICY tenant_select ON "tache_commentaire" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN' OR public.tache_visible(tache_id));
CREATE POLICY tenant_insert ON "tache_commentaire" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.tache_visible(tache_id) AND auteur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

CREATE POLICY tenant_select ON "tache_log" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN' OR public.tache_visible(tache_id));
CREATE POLICY tenant_insert ON "tache_log" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND public.tache_visible(tache_id))
  );
