-- CreateEnum
CREATE TYPE "StatutCabinet" AS ENUM ('ACTIF', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "RoleCabinet" AS ENUM ('CABINET_ADMIN', 'CABINET_GESTIONNAIRE', 'CABINET_COMPTABLE');

-- CreateEnum
CREATE TYPE "StatutMandat" AS ENUM ('EN_ATTENTE', 'ACTIF', 'TERMINE');

-- CreateEnum
CREATE TYPE "TypeCabinetLog" AS ENUM ('CABINET_CREE', 'CABINET_MODIFIE', 'MEMBRE_AJOUTE', 'MEMBRE_MODIFIE', 'MEMBRE_RETIRE', 'MANDAT_PROPOSE', 'MANDAT_CONFIRME', 'MANDAT_MODIFIE', 'MANDAT_TERMINE', 'ACCES_APPLIQUE', 'PRESTATAIRE_MODELE');

-- AlterEnum
ALTER TYPE "RoleType" ADD VALUE 'SYNDIC_COMPTABLE';

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "cabinet_id" UUID;

-- AlterTable
ALTER TABLE "prestataire" ADD COLUMN     "cabinet_prestataire_id" UUID;

-- AlterTable
ALTER TABLE "role_utilisateur" ADD COLUMN     "cabinet_id" UUID;

-- CreateTable
CREATE TABLE "cabinet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nom" TEXT NOT NULL,
    "raison_sociale" TEXT,
    "ice" TEXT,
    "rc" TEXT,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "logo_storage_path" TEXT,
    "statut" "StatutCabinet" NOT NULL DEFAULT 'ACTIF',
    "parametres_json" JSONB,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_membre" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "role" "RoleCabinet" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_membre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_copropriete" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "copropriete_id" UUID NOT NULL,
    "gestionnaire_principal_id" UUID,
    "date_debut_mandat" DATE NOT NULL,
    "date_fin_mandat" DATE,
    "resolution_ag_id" UUID,
    "honoraires_mensuels" DECIMAL(14,2),
    "contrat_id" UUID,
    "statut" "StatutMandat" NOT NULL DEFAULT 'EN_ATTENTE',
    "confirme_par_id" UUID,
    "confirme_le" TIMESTAMPTZ,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_copropriete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "type" "TypeCabinetLog" NOT NULL,
    "acteur_id" UUID,
    "copropriete_id" UUID,
    "details_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_prestataire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cabinet_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "specialite" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "ice" TEXT,
    "rc" TEXT,
    "adresse" TEXT,
    "notes" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_prestataire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cabinet_membre_utilisateur_id_idx" ON "cabinet_membre"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_membre_cabinet_id_utilisateur_id_key" ON "cabinet_membre"("cabinet_id", "utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_copropriete_contrat_id_key" ON "cabinet_copropriete"("contrat_id");

-- CreateIndex
CREATE INDEX "cabinet_copropriete_cabinet_id_idx" ON "cabinet_copropriete"("cabinet_id");

-- CreateIndex
CREATE INDEX "cabinet_copropriete_copropriete_id_idx" ON "cabinet_copropriete"("copropriete_id");

-- CreateIndex
CREATE INDEX "cabinet_log_cabinet_id_horodatage_idx" ON "cabinet_log"("cabinet_id", "horodatage");

-- CreateIndex
CREATE INDEX "cabinet_prestataire_cabinet_id_idx" ON "cabinet_prestataire"("cabinet_id");

-- AddForeignKey
ALTER TABLE "copropriete" ADD CONSTRAINT "copropriete_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_utilisateur" ADD CONSTRAINT "role_utilisateur_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestataire" ADD CONSTRAINT "prestataire_cabinet_prestataire_id_fkey" FOREIGN KEY ("cabinet_prestataire_id") REFERENCES "cabinet_prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_membre" ADD CONSTRAINT "cabinet_membre_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_membre" ADD CONSTRAINT "cabinet_membre_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT "cabinet_copropriete_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT "cabinet_copropriete_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT "cabinet_copropriete_gestionnaire_principal_id_fkey" FOREIGN KEY ("gestionnaire_principal_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT "cabinet_copropriete_resolution_ag_id_fkey" FOREIGN KEY ("resolution_ag_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT "cabinet_copropriete_contrat_id_fkey" FOREIGN KEY ("contrat_id") REFERENCES "contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT "cabinet_copropriete_confirme_par_id_fkey" FOREIGN KEY ("confirme_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_log" ADD CONSTRAINT "cabinet_log_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_log" ADD CONSTRAINT "cabinet_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_log" ADD CONSTRAINT "cabinet_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_prestataire" ADD CONSTRAINT "cabinet_prestataire_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ════════════════════════════════════════════════════════════════════════════
-- M25 — Cabinet / portefeuille : droits, RLS (membres du cabinet via cabinet_role_courant), journal
-- append-only, réconciliation des accès (role_utilisateur.cabinet_id), vue matérialisée des KPI du
-- portefeuille (lecture UNIQUEMENT par cabinet_portefeuille, SECURITY DEFINER), rôle SYNDIC_COMPTABLE
-- (lecture seule des finances : policies SELECT additives, aucune policy existante assouplie).
-- ════════════════════════════════════════════════════════════════════════════
CREATE UNIQUE INDEX cabinet_copropriete_actif_unique ON "cabinet_copropriete" (copropriete_id) WHERE actif = true;
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT cabinet_copropriete_dates_check CHECK (date_fin_mandat IS NULL OR date_fin_mandat >= date_debut_mandat);
ALTER TABLE "cabinet_copropriete" ADD CONSTRAINT cabinet_copropriete_honoraires_check CHECK (honoraires_mensuels IS NULL OR honoraires_mensuels >= 0);

GRANT SELECT, INSERT, UPDATE, DELETE ON "cabinet", "cabinet_membre", "cabinet_copropriete", "cabinet_prestataire" TO application_role;
GRANT SELECT, INSERT ON "cabinet_log" TO application_role;

-- Rôle du compte courant dans un cabinet ('SUPER_ADMIN' pour l'opérateur), NULL sinon.
CREATE OR REPLACE FUNCTION public.cabinet_role_courant(p_cabinet_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN current_setting('app.current_role', true) = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'
    ELSE (SELECT m.role::text FROM "cabinet_membre" m
          WHERE m.cabinet_id = p_cabinet_id AND m.actif = true
            AND m.utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
          LIMIT 1)
  END;
$$;
REVOKE ALL ON FUNCTION public.cabinet_role_courant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_role_courant(uuid) TO application_role;

ALTER TABLE "cabinet" ENABLE ROW LEVEL SECURITY; ALTER TABLE "cabinet" FORCE ROW LEVEL SECURITY;
ALTER TABLE "cabinet_membre" ENABLE ROW LEVEL SECURITY; ALTER TABLE "cabinet_membre" FORCE ROW LEVEL SECURITY;
ALTER TABLE "cabinet_copropriete" ENABLE ROW LEVEL SECURITY; ALTER TABLE "cabinet_copropriete" FORCE ROW LEVEL SECURITY;
ALTER TABLE "cabinet_log" ENABLE ROW LEVEL SECURITY; ALTER TABLE "cabinet_log" FORCE ROW LEVEL SECURITY;
ALTER TABLE "cabinet_prestataire" ENABLE ROW LEVEL SECURITY; ALTER TABLE "cabinet_prestataire" FORCE ROW LEVEL SECURITY;

CREATE POLICY membre_select ON "cabinet" FOR SELECT USING (public.cabinet_role_courant(id) IS NOT NULL);
CREATE POLICY admin_write ON "cabinet" FOR UPDATE USING (public.cabinet_role_courant(id) IN ('CABINET_ADMIN', 'SUPER_ADMIN')) WITH CHECK (public.cabinet_role_courant(id) IN ('CABINET_ADMIN', 'SUPER_ADMIN'));
CREATE POLICY super_admin_insert ON "cabinet" FOR INSERT WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');

CREATE POLICY membre_select ON "cabinet_membre" FOR SELECT USING (public.cabinet_role_courant(cabinet_id) IS NOT NULL);
CREATE POLICY admin_write ON "cabinet_membre" FOR ALL USING (public.cabinet_role_courant(cabinet_id) IN ('CABINET_ADMIN', 'SUPER_ADMIN')) WITH CHECK (public.cabinet_role_courant(cabinet_id) IN ('CABINET_ADMIN', 'SUPER_ADMIN'));

-- Mandats : membres du cabinet ; le SYNDIC en place de la copropriété voit et confirme le mandat proposé.
CREATE POLICY membre_select ON "cabinet_copropriete" FOR SELECT
  USING (public.cabinet_role_courant(cabinet_id) IS NOT NULL
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')));
CREATE POLICY admin_write ON "cabinet_copropriete" FOR ALL USING (public.cabinet_role_courant(cabinet_id) IN ('CABINET_ADMIN', 'SUPER_ADMIN')) WITH CHECK (public.cabinet_role_courant(cabinet_id) IN ('CABINET_ADMIN', 'SUPER_ADMIN'));
CREATE POLICY syndic_confirme ON "cabinet_copropriete" FOR UPDATE
  USING (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC')
  WITH CHECK (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC');

CREATE POLICY membre_select ON "cabinet_log" FOR SELECT USING (public.cabinet_role_courant(cabinet_id) IS NOT NULL);
CREATE POLICY membre_insert ON "cabinet_log" FOR INSERT WITH CHECK (public.cabinet_role_courant(cabinet_id) IS NOT NULL
  OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'));

CREATE POLICY membre_select ON "cabinet_prestataire" FOR SELECT USING (public.cabinet_role_courant(cabinet_id) IS NOT NULL);
CREATE POLICY admin_write ON "cabinet_prestataire" FOR ALL USING (public.cabinet_role_courant(cabinet_id) IN ('CABINET_ADMIN', 'CABINET_GESTIONNAIRE', 'SUPER_ADMIN')) WITH CHECK (public.cabinet_role_courant(cabinet_id) IN ('CABINET_ADMIN', 'CABINET_GESTIONNAIRE', 'SUPER_ADMIN'));

-- ────────────────────────────────────────────────────────────────────────────
-- Réconciliation des accès : les rôles de copropriété posés par le cabinet (role_utilisateur.cabinet_id)
-- sont recalculés depuis les mandats ACTIFS et les membres actifs — gestionnaire principal → SYNDIC,
-- comptables → SYNDIC_COMPTABLE ; tout rôle du cabinet qui n'est plus justifié est désactivé dans la
-- même transaction. Idempotente ; jamais de suppression physique.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cabinet_appliquer_acces(p_cabinet_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voulus int := 0; v_desactives int := 0; v_r record;
  v_temp text := 'cabinet_acces_voulus';
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS cabinet_acces_voulus (utilisateur_id uuid, copropriete_id uuid, role text) ON COMMIT DROP;
  DELETE FROM cabinet_acces_voulus;
  INSERT INTO cabinet_acces_voulus
    SELECT m.gestionnaire_principal_id, m.copropriete_id, 'SYNDIC'
    FROM "cabinet_copropriete" m
    JOIN "cabinet_membre" cm ON cm.cabinet_id = m.cabinet_id AND cm.utilisateur_id = m.gestionnaire_principal_id AND cm.actif = true AND cm.role IN ('CABINET_ADMIN', 'CABINET_GESTIONNAIRE')
    WHERE m.cabinet_id = p_cabinet_id AND m.actif = true AND m.statut = 'ACTIF' AND m.gestionnaire_principal_id IS NOT NULL
  UNION
    SELECT cm.utilisateur_id, m.copropriete_id, 'SYNDIC_COMPTABLE'
    FROM "cabinet_copropriete" m
    JOIN "cabinet_membre" cm ON cm.cabinet_id = m.cabinet_id AND cm.actif = true AND cm.role = 'CABINET_COMPTABLE'
    WHERE m.cabinet_id = p_cabinet_id AND m.actif = true AND m.statut = 'ACTIF';
  -- 1. Désactiver ce qui n'est plus voulu.
  FOR v_r IN
    SELECT ru.id FROM "role_utilisateur" ru
    WHERE ru.cabinet_id = p_cabinet_id AND ru.actif = true
      AND NOT EXISTS (SELECT 1 FROM cabinet_acces_voulus v WHERE v.utilisateur_id = ru.utilisateur_id AND v.copropriete_id = ru.copropriete_id AND v.role = ru.role::text)
  LOOP
    UPDATE "role_utilisateur" SET actif = false WHERE id = v_r.id; v_desactives := v_desactives + 1;
  END LOOP;
  -- 2. Poser / réactiver ce qui est voulu (un SYNDIC actif par copropriété : un autre SYNDIC humain actif bloque → conflit remonté).
  FOR v_r IN SELECT * FROM cabinet_acces_voulus LOOP
    IF v_r.role = 'SYNDIC' AND EXISTS (SELECT 1 FROM "role_utilisateur" WHERE copropriete_id = v_r.copropriete_id AND role = 'SYNDIC' AND actif = true AND utilisateur_id <> v_r.utilisateur_id) THEN
      RAISE EXCEPTION 'CONFLIT_SYNDIC : un autre syndic est actif sur la copropriété % — le mandat doit être confirmé par lui.', v_r.copropriete_id USING ERRCODE = 'unique_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM "role_utilisateur" WHERE utilisateur_id = v_r.utilisateur_id AND copropriete_id = v_r.copropriete_id AND role = v_r.role::"RoleType" AND actif = true) THEN
      UPDATE "role_utilisateur" SET cabinet_id = COALESCE(cabinet_id, p_cabinet_id) WHERE utilisateur_id = v_r.utilisateur_id AND copropriete_id = v_r.copropriete_id AND role = v_r.role::"RoleType" AND actif = true;
    ELSE
      UPDATE "role_utilisateur" SET actif = true, cabinet_id = p_cabinet_id
        WHERE utilisateur_id = v_r.utilisateur_id AND copropriete_id = v_r.copropriete_id AND role = v_r.role::"RoleType" AND actif = false AND cabinet_id = p_cabinet_id;
      IF NOT FOUND THEN
        INSERT INTO "role_utilisateur" (utilisateur_id, copropriete_id, role, actif, cabinet_id) VALUES (v_r.utilisateur_id, v_r.copropriete_id, v_r.role::"RoleType", true, p_cabinet_id);
      END IF;
    END IF;
    v_voulus := v_voulus + 1;
  END LOOP;
  INSERT INTO "cabinet_log" (cabinet_id, type, acteur_id, details_json)
  VALUES (p_cabinet_id, 'ACCES_APPLIQUE', NULLIF(current_setting('app.current_user_id', true), '')::uuid, jsonb_build_object('voulus', v_voulus, 'desactives', v_desactives));
  RETURN jsonb_build_object('voulus', v_voulus, 'desactives', v_desactives);
END $$;
REVOKE ALL ON FUNCTION public.cabinet_appliquer_acces(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_appliquer_acces(uuid) TO application_role;

-- Confirmation d'un mandat par le SYNDIC en place (contexte copropriété) : il cède la fonction au
-- gestionnaire principal du cabinet (son rôle SYNDIC est désactivé s'il n'est pas lui-même ce gestionnaire),
-- la copropriété est rattachée au cabinet, les accès sont appliqués — le tout atomiquement.
CREATE OR REPLACE FUNCTION public.cabinet_mandat_confirmer(p_mandat_id uuid, p_utilisateur_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m "cabinet_copropriete"%ROWTYPE; v_cedes int := 0;
BEGIN
  SELECT * INTO v_m FROM "cabinet_copropriete" WHERE id = p_mandat_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('statut', 'INTROUVABLE'); END IF;
  IF v_m.statut <> 'EN_ATTENTE' OR v_m.actif = false THEN RETURN jsonb_build_object('statut', 'STATUT_INVALIDE'); END IF;
  IF NOT EXISTS (SELECT 1 FROM "role_utilisateur" WHERE utilisateur_id = p_utilisateur_id AND copropriete_id = v_m.copropriete_id AND role = 'SYNDIC' AND actif = true)
     AND current_setting('app.current_role', true) <> 'SUPER_ADMIN' THEN
    RETURN jsonb_build_object('statut', 'NON_SYNDIC');
  END IF;
  IF EXISTS (SELECT 1 FROM "cabinet_copropriete" WHERE copropriete_id = v_m.copropriete_id AND actif = true AND statut = 'ACTIF' AND id <> v_m.id) THEN
    RETURN jsonb_build_object('statut', 'MANDAT_EXISTANT');
  END IF;
  UPDATE "role_utilisateur" SET actif = false
    WHERE copropriete_id = v_m.copropriete_id AND role = 'SYNDIC' AND actif = true
      AND (v_m.gestionnaire_principal_id IS NULL OR utilisateur_id <> v_m.gestionnaire_principal_id);
  GET DIAGNOSTICS v_cedes = ROW_COUNT;
  UPDATE "cabinet_copropriete" SET statut = 'ACTIF', confirme_par_id = p_utilisateur_id, confirme_le = now() WHERE id = v_m.id;
  UPDATE "copropriete" SET cabinet_id = v_m.cabinet_id WHERE id = v_m.copropriete_id;
  INSERT INTO "cabinet_log" (cabinet_id, type, acteur_id, copropriete_id, details_json)
  VALUES (v_m.cabinet_id, 'MANDAT_CONFIRME', p_utilisateur_id, v_m.copropriete_id, jsonb_build_object('mandat_id', v_m.id, 'syndics_cedes', v_cedes));
  PERFORM public.cabinet_appliquer_acces(v_m.cabinet_id);
  RETURN jsonb_build_object('statut', 'OK', 'cabinet_id', v_m.cabinet_id, 'copropriete_id', v_m.copropriete_id, 'syndics_cedes', v_cedes);
END $$;
REVOKE ALL ON FUNCTION public.cabinet_mandat_confirmer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_mandat_confirmer(uuid, uuid) TO application_role;

-- Fin de mandat : le cabinet perd la copropriété, ses accès sont révoqués atomiquement.
CREATE OR REPLACE FUNCTION public.cabinet_mandat_terminer(p_mandat_id uuid, p_date_fin date, p_utilisateur_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m "cabinet_copropriete"%ROWTYPE; v_acces jsonb;
BEGIN
  SELECT * INTO v_m FROM "cabinet_copropriete" WHERE id = p_mandat_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('statut', 'INTROUVABLE'); END IF;
  IF v_m.actif = false THEN RETURN jsonb_build_object('statut', 'STATUT_INVALIDE'); END IF;
  UPDATE "cabinet_copropriete" SET statut = 'TERMINE', actif = false, date_fin_mandat = COALESCE(p_date_fin, CURRENT_DATE) WHERE id = v_m.id;
  UPDATE "copropriete" SET cabinet_id = NULL WHERE id = v_m.copropriete_id AND cabinet_id = v_m.cabinet_id;
  INSERT INTO "cabinet_log" (cabinet_id, type, acteur_id, copropriete_id, details_json)
  VALUES (v_m.cabinet_id, 'MANDAT_TERMINE', p_utilisateur_id, v_m.copropriete_id, jsonb_build_object('mandat_id', v_m.id, 'date_fin', COALESCE(p_date_fin, CURRENT_DATE)));
  v_acces := public.cabinet_appliquer_acces(v_m.cabinet_id);
  RETURN jsonb_build_object('statut', 'OK', 'acces', v_acces);
END $$;
REVOKE ALL ON FUNCTION public.cabinet_mandat_terminer(uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_mandat_terminer(uuid, date, uuid) TO application_role;

-- ────────────────────────────────────────────────────────────────────────────
-- KPI du portefeuille : vue matérialisée (rafraîchie toutes les 15 min par le job), jamais lue directement
-- par application_role — uniquement via cabinet_portefeuille(cabinet) qui applique l'appartenance.
-- ────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW public.portefeuille_kpi AS
SELECT
  c.id AS copropriete_id, c.nom, c.ville, c.est_demo,
  (SELECT count(*) FROM "lot" l WHERE l.copropriete_id = c.id)::int AS nb_lots,
  COALESCE((SELECT sum(afl.montant_du) FROM "appel_de_fonds_lot" afl JOIN "appel_de_fonds" af ON af.id = afl.appel_de_fonds_id WHERE af.copropriete_id = c.id AND af.statut <> 'BROUILLON'), 0)::numeric(14,2) AS appele,
  COALESCE((SELECT sum(afl.montant_paye) FROM "appel_de_fonds_lot" afl JOIN "appel_de_fonds" af ON af.id = afl.appel_de_fonds_id WHERE af.copropriete_id = c.id AND af.statut <> 'BROUILLON'), 0)::numeric(14,2) AS encaisse,
  COALESCE((SELECT sum(afl.montant_du - afl.montant_paye) FROM "appel_de_fonds_lot" afl JOIN "appel_de_fonds" af ON af.id = afl.appel_de_fonds_id WHERE af.copropriete_id = c.id AND af.statut <> 'BROUILLON' AND afl.statut IN ('IMPAYE', 'PARTIEL') AND af.date_echeance < CURRENT_DATE), 0)::numeric(14,2) AS impayes_montant,
  (SELECT count(DISTINCT afl.lot_id) FROM "appel_de_fonds_lot" afl JOIN "appel_de_fonds" af ON af.id = afl.appel_de_fonds_id WHERE af.copropriete_id = c.id AND af.statut <> 'BROUILLON' AND afl.statut IN ('IMPAYE', 'PARTIEL') AND af.date_echeance < CURRENT_DATE)::int AS impayes_nb_lots,
  (SELECT count(*) FROM "justificatif_paiement" j WHERE j.copropriete_id = c.id AND j.statut = 'EN_ATTENTE')::int AS justificatifs_en_attente,
  (SELECT min(j.cree_le) FROM "justificatif_paiement" j WHERE j.copropriete_id = c.id AND j.statut = 'EN_ATTENTE') AS justificatif_plus_ancien,
  (SELECT count(*) FROM "incident" i WHERE i.copropriete_id = c.id AND i.statut IN ('OUVERT', 'EN_COURS'))::int AS incidents_ouverts,
  (SELECT count(*) FROM "incident" i WHERE i.copropriete_id = c.id AND i.statut IN ('OUVERT', 'EN_COURS') AND i.urgence IN ('URGENTE', 'URGENCE_MAXIMALE'))::int AS incidents_urgents,
  (SELECT count(*) FROM "tache" t WHERE t.copropriete_id = c.id AND t.statut IN ('A_FAIRE', 'EN_COURS', 'BLOQUEE') AND t.date_echeance < CURRENT_DATE)::int AS taches_retard,
  (SELECT min(a.date_ag) FROM "assemblee_generale" a WHERE a.copropriete_id = c.id AND a.date_ag >= now() AND a.statut IN ('PLANIFIEE', 'CONVOQUEE', 'EN_COURS')) AS prochaine_ag,
  (SELECT count(*) FROM "contrat" k WHERE k.copropriete_id = c.id AND k.statut = 'ACTIF' AND k.date_fin IS NOT NULL AND k.date_fin BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)::int AS contrats_expirant_30j,
  EXISTS (SELECT 1 FROM "contrat" k WHERE k.copropriete_id = c.id AND k.type = 'ASSURANCE_IMMEUBLE' AND k.statut = 'ACTIF' AND (k.date_fin IS NULL OR k.date_fin >= CURRENT_DATE)) AS assurance_active,
  (SELECT count(*) FROM "sejour_courte_duree" s WHERE s.copropriete_id = c.id AND s.statut IN ('PREVU', 'EN_COURS') AND s.date_arrivee <= CURRENT_DATE AND s.date_depart >= CURRENT_DATE)::int AS sejours_lcd_aujourdhui,
  (SELECT max(al.horodatage) FROM "audit_log" al WHERE al.copropriete_id = c.id) AS derniere_activite,
  now() AS calcule_le
FROM "copropriete" c;
CREATE UNIQUE INDEX portefeuille_kpi_copropriete_idx ON public.portefeuille_kpi (copropriete_id);
REVOKE ALL ON public.portefeuille_kpi FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.portefeuille_kpi_rafraichir()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.portefeuille_kpi;
$$;
REVOKE ALL ON FUNCTION public.portefeuille_kpi_rafraichir() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portefeuille_kpi_rafraichir() TO application_role;

-- Une ligne par mandat ACTIF du cabinet visible par le compte courant : ADMIN / COMPTABLE / SUPER_ADMIN tout,
-- GESTIONNAIRE ses copropriétés (gestionnaire principal). Jamais une copropriété d'un autre cabinet.
CREATE OR REPLACE FUNCTION public.cabinet_portefeuille(p_cabinet_id uuid)
RETURNS TABLE (
  mandat_id uuid, copropriete_id uuid, nom text, ville text, est_demo boolean, gestionnaire_principal_id uuid, date_debut_mandat date, honoraires_mensuels numeric,
  nb_lots int, appele numeric, encaisse numeric, impayes_montant numeric, impayes_nb_lots int, justificatifs_en_attente int, justificatif_plus_ancien timestamptz,
  incidents_ouverts int, incidents_urgents int, taches_retard int, prochaine_ag timestamptz, contrats_expirant_30j int, assurance_active boolean, sejours_lcd_aujourdhui int,
  derniere_activite timestamptz, calcule_le timestamptz
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_role text; v_user uuid;
BEGIN
  v_role := public.cabinet_role_courant(p_cabinet_id);
  v_user := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  IF v_role IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT m.id, k.copropriete_id, k.nom, k.ville, k.est_demo, m.gestionnaire_principal_id, m.date_debut_mandat, m.honoraires_mensuels,
           k.nb_lots, k.appele, k.encaisse, k.impayes_montant, k.impayes_nb_lots, k.justificatifs_en_attente, k.justificatif_plus_ancien,
           k.incidents_ouverts, k.incidents_urgents, k.taches_retard, k.prochaine_ag, k.contrats_expirant_30j, k.assurance_active, k.sejours_lcd_aujourdhui,
           k.derniere_activite, k.calcule_le
    FROM "cabinet_copropriete" m
    JOIN public.portefeuille_kpi k ON k.copropriete_id = m.copropriete_id
    WHERE m.cabinet_id = p_cabinet_id AND m.actif = true AND m.statut = 'ACTIF'
      AND (v_role IN ('CABINET_ADMIN', 'CABINET_COMPTABLE', 'SUPER_ADMIN') OR m.gestionnaire_principal_id = v_user)
    ORDER BY k.nom;
END $$;
REVOKE ALL ON FUNCTION public.cabinet_portefeuille(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_portefeuille(uuid) TO application_role;

-- Copropriétés visibles d'un membre (même règle que le portefeuille) — agenda / alertes calculés en direct.
CREATE OR REPLACE FUNCTION public.cabinet_coproprietes_visibles(p_cabinet_id uuid)
RETURNS TABLE (copropriete_id uuid, nom text) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_role text; v_user uuid;
BEGIN
  v_role := public.cabinet_role_courant(p_cabinet_id);
  v_user := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  IF v_role IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT m.copropriete_id, c.nom FROM "cabinet_copropriete" m JOIN "copropriete" c ON c.id = m.copropriete_id
    WHERE m.cabinet_id = p_cabinet_id AND m.actif = true AND m.statut = 'ACTIF'
      AND (v_role IN ('CABINET_ADMIN', 'CABINET_COMPTABLE', 'SUPER_ADMIN') OR m.gestionnaire_principal_id = v_user) ORDER BY c.nom;
END $$;
REVOKE ALL ON FUNCTION public.cabinet_coproprietes_visibles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_coproprietes_visibles(uuid) TO application_role;

-- ────────────────────────────────────────────────────────────────────────────
-- SYNDIC_COMPTABLE : lecture seule des finances — policies SELECT ADDITIVES (aucune policy existante
-- modifiée) sur les tables dont la lecture est réservée au syndic / conseil ; export_log en écriture
-- (journal des exports).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record; v_copro text := 'NULLIF(current_setting(''app.current_copropriete_id'', true), '''')::uuid'; v_role text := 'current_setting(''app.current_role'', true) = ''SYNDIC_COMPTABLE''';
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('depense', 'copropriete_id = %s'),
    ('depense_log', 'copropriete_id = %s'),
    ('justificatif_paiement', 'copropriete_id = %s'),
    ('fonds_reserve', 'copropriete_id = %s'),
    ('rapport_gestion', 'copropriete_id = %s'),
    ('contrat', 'copropriete_id = %s'),
    ('contrat_log', 'copropriete_id = %s'),
    ('export_log', 'copropriete_id = %s'),
    ('solde_ouverture', 'copropriete_id = %s'),
    ('import_job', 'copropriete_id = %s'),
    ('appel_de_fonds_lot', 'EXISTS (SELECT 1 FROM "appel_de_fonds" af WHERE af.id = appel_de_fonds_id AND af.copropriete_id = %s)'),
    ('paiement', 'EXISTS (SELECT 1 FROM "lot" l WHERE l.id = lot_id AND l.copropriete_id = %s)'),
    ('quittance', 'EXISTS (SELECT 1 FROM "appel_de_fonds_lot" afl JOIN "appel_de_fonds" af ON af.id = afl.appel_de_fonds_id WHERE afl.id = appel_de_fonds_lot_id AND af.copropriete_id = %s)'),
    ('contestation_charge', 'EXISTS (SELECT 1 FROM "appel_de_fonds_lot" afl JOIN "appel_de_fonds" af ON af.id = afl.appel_de_fonds_id WHERE afl.id = appel_de_fonds_lot_id AND af.copropriete_id = %s)'),
    ('facture', 'EXISTS (SELECT 1 FROM "depense" d WHERE d.id = depense_id AND d.copropriete_id = %s)'),
    ('fonds_reserve_mouvement', 'EXISTS (SELECT 1 FROM "fonds_reserve" f WHERE f.id = fonds_reserve_id AND f.copropriete_id = %s)'),
    ('contrat_echeance', 'EXISTS (SELECT 1 FROM "contrat" k WHERE k.id = contrat_id AND k.copropriete_id = %s)'),
    ('lot_proprietaire', 'EXISTS (SELECT 1 FROM "lot" l WHERE l.id = lot_id AND l.copropriete_id = %s)'),
    ('lot_occupant', 'EXISTS (SELECT 1 FROM "lot" l WHERE l.id = lot_id AND l.copropriete_id = %s)')
  ) AS t(tbl, pred)
  LOOP
    EXECUTE format('CREATE POLICY comptable_select ON %I FOR SELECT USING (%s AND %s)', r.tbl, v_role, format(r.pred, v_copro));
  END LOOP;
END $$;
CREATE POLICY comptable_insert ON "export_log" FOR INSERT WITH CHECK (current_setting('app.current_role', true) = 'SYNDIC_COMPTABLE' AND copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid);
