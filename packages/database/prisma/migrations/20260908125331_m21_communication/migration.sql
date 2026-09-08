-- CreateEnum
CREATE TYPE "CategorieAnnonce" AS ENUM ('INFORMATION', 'TRAVAUX', 'COUPURE', 'SECURITE', 'URGENCE', 'AG', 'CONVIVIALITE', 'REGLEMENT');

-- CreateEnum
CREATE TYPE "AudienceCommunication" AS ENUM ('TOUS', 'PROPRIETAIRES', 'OCCUPANTS', 'CONSEIL', 'BATIMENT');

-- CreateEnum
CREATE TYPE "StatutAnnonce" AS ENUM ('BROUILLON', 'PUBLIEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "StatutSondage" AS ENUM ('BROUILLON', 'OUVERT', 'CLOS');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "annonce_id" UUID;

-- AlterTable
ALTER TABLE "lot" ADD COLUMN     "batiment" TEXT;

-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "preferences_notification_json" JSONB;

-- CreateTable
CREATE TABLE "annonce" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "auteur_id" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "categorie" "CategorieAnnonce" NOT NULL,
    "audience" "AudienceCommunication" NOT NULL DEFAULT 'TOUS',
    "batiment" TEXT,
    "epingle" BOOLEAN NOT NULL DEFAULT false,
    "publie_le" TIMESTAMPTZ,
    "expire_le" TIMESTAMPTZ,
    "statut" "StatutAnnonce" NOT NULL DEFAULT 'BROUILLON',
    "commentaires_actives" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "annonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annonce_lecture" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "annonce_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "lu_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annonce_lecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annonce_commentaire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "annonce_id" UUID NOT NULL,
    "auteur_id" UUID NOT NULL,
    "contenu" TEXT NOT NULL,
    "masque_par_id" UUID,
    "masque_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annonce_commentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "auteur_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "options_json" JSONB NOT NULL,
    "choix_multiple" BOOLEAN NOT NULL DEFAULT false,
    "anonyme" BOOLEAN NOT NULL DEFAULT true,
    "audience" "AudienceCommunication" NOT NULL DEFAULT 'TOUS',
    "batiment" TEXT,
    "ponderation_tantiemes" BOOLEAN NOT NULL DEFAULT false,
    "date_fin" TIMESTAMPTZ NOT NULL,
    "statut" "StatutSondage" NOT NULL DEFAULT 'BROUILLON',
    "ouvert_le" TIMESTAMPTZ,
    "clos_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sondage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sondage_reponse" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sondage_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "choix_json" JSONB NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sondage_reponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_utile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "libelle" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contact_utile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "annonce_copropriete_id_statut_epingle_publie_le_idx" ON "annonce"("copropriete_id", "statut", "epingle", "publie_le");

-- CreateIndex
CREATE UNIQUE INDEX "annonce_lecture_annonce_id_utilisateur_id_key" ON "annonce_lecture"("annonce_id", "utilisateur_id");

-- CreateIndex
CREATE INDEX "annonce_commentaire_annonce_id_cree_le_idx" ON "annonce_commentaire"("annonce_id", "cree_le");

-- CreateIndex
CREATE INDEX "sondage_copropriete_id_statut_date_fin_idx" ON "sondage"("copropriete_id", "statut", "date_fin");

-- CreateIndex
CREATE UNIQUE INDEX "sondage_reponse_sondage_id_utilisateur_id_key" ON "sondage_reponse"("sondage_id", "utilisateur_id");

-- CreateIndex
CREATE INDEX "contact_utile_copropriete_id_ordre_idx" ON "contact_utile"("copropriete_id", "ordre");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "annonce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce" ADD CONSTRAINT "annonce_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce" ADD CONSTRAINT "annonce_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce_lecture" ADD CONSTRAINT "annonce_lecture_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "annonce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce_lecture" ADD CONSTRAINT "annonce_lecture_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce_commentaire" ADD CONSTRAINT "annonce_commentaire_annonce_id_fkey" FOREIGN KEY ("annonce_id") REFERENCES "annonce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce_commentaire" ADD CONSTRAINT "annonce_commentaire_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annonce_commentaire" ADD CONSTRAINT "annonce_commentaire_masque_par_id_fkey" FOREIGN KEY ("masque_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage" ADD CONSTRAINT "sondage_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage" ADD CONSTRAINT "sondage_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponse" ADD CONSTRAINT "sondage_reponse_sondage_id_fkey" FOREIGN KEY ("sondage_id") REFERENCES "sondage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sondage_reponse" ADD CONSTRAINT "sondage_reponse_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_utile" ADD CONSTRAINT "contact_utile_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- M21 — COMMUNICATION : contraintes, fonctions d'audience (SECURITY DEFINER), RLS.
-- Deux couches indépendantes (CLAUDE.md §1.8) : l'API filtre l'audience ET la policy la filtre.
-- ─────────────────────────────────────────────────────────────────────────────

-- CHECKs
ALTER TABLE "annonce"
  ADD CONSTRAINT annonce_titre_check CHECK (char_length(titre) BETWEEN 1 AND 200),
  ADD CONSTRAINT annonce_contenu_check CHECK (char_length(contenu) <= 20000),
  ADD CONSTRAINT annonce_batiment_check CHECK (audience <> 'BATIMENT' OR batiment IS NOT NULL),
  ADD CONSTRAINT annonce_expiration_check CHECK (expire_le IS NULL OR publie_le IS NULL OR expire_le > publie_le),
  ADD CONSTRAINT annonce_publiee_check CHECK (statut = 'BROUILLON' OR publie_le IS NOT NULL);
ALTER TABLE "annonce_commentaire"
  ADD CONSTRAINT annonce_commentaire_contenu_check CHECK (char_length(contenu) BETWEEN 1 AND 2000);
ALTER TABLE "sondage"
  ADD CONSTRAINT sondage_question_check CHECK (char_length(question) BETWEEN 1 AND 300),
  ADD CONSTRAINT sondage_options_check CHECK (jsonb_typeof(options_json) = 'array' AND jsonb_array_length(options_json) BETWEEN 2 AND 10),
  ADD CONSTRAINT sondage_batiment_check CHECK (audience <> 'BATIMENT' OR batiment IS NOT NULL);
ALTER TABLE "sondage_reponse"
  ADD CONSTRAINT sondage_reponse_choix_check CHECK (jsonb_typeof(choix_json) = 'array' AND jsonb_array_length(choix_json) >= 1);
ALTER TABLE "contact_utile"
  ADD CONSTRAINT contact_utile_libelle_check CHECK (char_length(libelle) BETWEEN 1 AND 120),
  ADD CONSTRAINT contact_utile_telephone_check CHECK (char_length(telephone) BETWEEN 3 AND 30);

-- Fonctions de résolution (SECURITY DEFINER : lisent sous RLS contournée, ne renvoient que des booléens / ids).
CREATE OR REPLACE FUNCTION public.annonce_copropriete_id(p_annonce_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "annonce" WHERE id = p_annonce_id;
$$;
CREATE OR REPLACE FUNCTION public.sondage_copropriete_id(p_sondage_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "sondage" WHERE id = p_sondage_id;
$$;

-- L'utilisateur courant (app.current_user_id) appartient-il à l'audience ?
--  TOUS          : tout membre du tenant.
--  PROPRIETAIRES : rôle propriétaire (PROPRIETAIRE / INDIVISAIRE / PERSONNE_MORALE_REPRESENTANT) actif
--                  OU propriétaire actif d'un lot de la copropriété.
--  OCCUPANTS     : rôle LOCATAIRE actif OU occupant en cours d'un lot de la copropriété.
--  CONSEIL       : rôle CONSEIL_SYNDICAL actif.
--  BATIMENT      : propriétaire ou occupant d'un lot dont lot.batiment = p_batiment.
CREATE OR REPLACE FUNCTION public.communication_audience_ok(p_audience "AudienceCommunication", p_batiment text, p_copropriete_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_user uuid := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;
  CASE p_audience
    WHEN 'TOUS' THEN
      RETURN EXISTS (SELECT 1 FROM "role_utilisateur" r WHERE r.utilisateur_id = v_user AND r.copropriete_id = p_copropriete_id AND r.actif);
    WHEN 'PROPRIETAIRES' THEN
      RETURN EXISTS (SELECT 1 FROM "role_utilisateur" r WHERE r.utilisateur_id = v_user AND r.copropriete_id = p_copropriete_id AND r.actif AND r.role IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT'))
          OR EXISTS (SELECT 1 FROM "lot_proprietaire" lp JOIN "lot" l ON l.id = lp.lot_id WHERE lp.utilisateur_id = v_user AND lp.date_fin IS NULL AND l.copropriete_id = p_copropriete_id);
    WHEN 'OCCUPANTS' THEN
      RETURN EXISTS (SELECT 1 FROM "role_utilisateur" r WHERE r.utilisateur_id = v_user AND r.copropriete_id = p_copropriete_id AND r.actif AND r.role = 'LOCATAIRE')
          OR EXISTS (SELECT 1 FROM "lot_occupant" lo JOIN "lot" l ON l.id = lo.lot_id WHERE lo.utilisateur_id = v_user AND lo.date_fin IS NULL AND l.copropriete_id = p_copropriete_id);
    WHEN 'CONSEIL' THEN
      RETURN EXISTS (SELECT 1 FROM "role_utilisateur" r WHERE r.utilisateur_id = v_user AND r.copropriete_id = p_copropriete_id AND r.actif AND r.role = 'CONSEIL_SYNDICAL');
    WHEN 'BATIMENT' THEN
      RETURN p_batiment IS NOT NULL AND EXISTS (
        SELECT 1 FROM "lot" l
        WHERE l.copropriete_id = p_copropriete_id AND l.batiment = p_batiment
          AND (l.id IN (SELECT lot_id FROM "lot_proprietaire" WHERE utilisateur_id = v_user AND date_fin IS NULL)
            OR l.id IN (SELECT lot_id FROM "lot_occupant" WHERE utilisateur_id = v_user AND date_fin IS NULL))
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Une annonce / un sondage est-il visible de l'utilisateur courant (tenant + statut + audience, ou gestion) ?
CREATE OR REPLACE FUNCTION public.annonce_visible(p_annonce_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "annonce" a
    WHERE a.id = p_annonce_id
      AND a.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SUPER_ADMIN', 'SYNDIC', 'CONSEIL_SYNDICAL')
        OR (a.statut = 'PUBLIEE' AND public.communication_audience_ok(a.audience, a.batiment, a.copropriete_id))
      )
  );
$$;
CREATE OR REPLACE FUNCTION public.sondage_visible(p_sondage_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "sondage" s
    WHERE s.id = p_sondage_id
      AND s.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SUPER_ADMIN', 'SYNDIC', 'CONSEIL_SYNDICAL')
        OR (s.statut IN ('OUVERT', 'CLOS') AND public.communication_audience_ok(s.audience, s.batiment, s.copropriete_id))
      )
  );
$$;

-- Résultats AGRÉGÉS d'un sondage — la seule voie de lecture des réponses des autres : jamais un
-- utilisateur_id en sortie. nb = nombre de répondants ayant coché l'option ; tantiemes = somme des
-- tantièmes des lots dont ils sont propriétaires actifs (pondération INFORMATIVE, Doc A §6 : un
-- sondage n'est pas un vote d'AG).
CREATE OR REPLACE FUNCTION public.sondage_resultats(p_sondage_id uuid)
RETURNS TABLE (option_id text, nb bigint, tantiemes numeric)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH visible AS (SELECT public.sondage_visible(p_sondage_id) AS ok),
  rep AS (
    SELECT r.utilisateur_id, jsonb_array_elements_text(r.choix_json) AS option_id
    FROM "sondage_reponse" r, visible v
    WHERE r.sondage_id = p_sondage_id AND v.ok
  ),
  poids AS (
    SELECT lp.utilisateur_id, COALESCE(SUM(l.tantiemes), 0) AS tantiemes
    FROM "lot_proprietaire" lp
    JOIN "lot" l ON l.id = lp.lot_id
    WHERE lp.date_fin IS NULL AND l.copropriete_id = public.sondage_copropriete_id(p_sondage_id)
    GROUP BY lp.utilisateur_id
  )
  SELECT rep.option_id, COUNT(DISTINCT rep.utilisateur_id)::bigint AS nb, COALESCE(SUM(DISTINCT_POIDS.tantiemes), 0)::numeric AS tantiemes
  FROM rep
  LEFT JOIN LATERAL (SELECT p.tantiemes FROM poids p WHERE p.utilisateur_id = rep.utilisateur_id) DISTINCT_POIDS ON true
  GROUP BY rep.option_id;
$$;
CREATE OR REPLACE FUNCTION public.sondage_participation(p_sondage_id uuid)
RETURNS TABLE (nb_reponses bigint, tantiemes numeric)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH visible AS (SELECT public.sondage_visible(p_sondage_id) AS ok),
  rep AS (SELECT r.utilisateur_id FROM "sondage_reponse" r, visible v WHERE r.sondage_id = p_sondage_id AND v.ok),
  poids AS (
    SELECT lp.utilisateur_id, COALESCE(SUM(l.tantiemes), 0) AS tantiemes
    FROM "lot_proprietaire" lp JOIN "lot" l ON l.id = lp.lot_id
    WHERE lp.date_fin IS NULL AND l.copropriete_id = public.sondage_copropriete_id(p_sondage_id)
    GROUP BY lp.utilisateur_id
  )
  SELECT COUNT(*)::bigint, COALESCE(SUM(p.tantiemes), 0)::numeric
  FROM rep LEFT JOIN poids p ON p.utilisateur_id = rep.utilisateur_id;
$$;

REVOKE ALL ON FUNCTION public.annonce_copropriete_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sondage_copropriete_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.communication_audience_ok("AudienceCommunication", text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.annonce_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sondage_visible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sondage_resultats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sondage_participation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.annonce_copropriete_id(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.sondage_copropriete_id(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.communication_audience_ok("AudienceCommunication", text, uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.annonce_visible(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.sondage_visible(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.sondage_resultats(uuid) TO application_role;
GRANT EXECUTE ON FUNCTION public.sondage_participation(uuid) TO application_role;

-- Droits : lectures et réponses sont append-only (pas d'UPDATE / DELETE) ; commentaires modérables (UPDATE) mais jamais supprimés.
GRANT SELECT, INSERT, UPDATE, DELETE ON "annonce", "sondage", "contact_utile" TO application_role;
GRANT SELECT, INSERT, UPDATE ON "annonce_commentaire" TO application_role;
GRANT SELECT, INSERT ON "annonce_lecture", "sondage_reponse" TO application_role;

ALTER TABLE "annonce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "annonce" FORCE ROW LEVEL SECURITY;
ALTER TABLE "annonce_lecture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "annonce_lecture" FORCE ROW LEVEL SECURITY;
ALTER TABLE "annonce_commentaire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "annonce_commentaire" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sondage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sondage" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sondage_reponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sondage_reponse" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contact_utile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_utile" FORCE ROW LEVEL SECURITY;

-- annonce : lecture = gestion (syndic / conseil, brouillons compris) ou audience d'une annonce PUBLIEE ;
-- écriture = syndic / conseil (la catégorie URGENCE est réservée au syndic côté API).
CREATE POLICY tenant_select ON "annonce" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR (statut = 'PUBLIEE' AND public.communication_audience_ok(audience, batiment, copropriete_id))
      )
    )
  );
CREATE POLICY tenant_write ON "annonce" FOR ALL
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL'))
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL'))
  );

-- annonce_lecture : chacun écrit et lit la sienne ; syndic / conseil lisent toutes (comptes « lu par n/N »).
CREATE POLICY tenant_select ON "annonce_lecture" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.annonce_visible(annonce_id)
        AND (current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
             OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  );
CREATE POLICY tenant_insert ON "annonce_lecture" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.annonce_visible(annonce_id) AND utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

-- annonce_commentaire : visible avec l'annonce, sauf masqué (le syndic et l'auteur le voient encore) ;
-- écriture = auteur courant ; modération (UPDATE) = syndic.
CREATE POLICY tenant_select ON "annonce_commentaire" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.annonce_visible(annonce_id)
        AND (masque_par_id IS NULL
             OR current_setting('app.current_role', true) = 'SYNDIC'
             OR auteur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  );
CREATE POLICY tenant_insert ON "annonce_commentaire" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.annonce_visible(annonce_id) AND auteur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );
CREATE POLICY tenant_moderation ON "annonce_commentaire" FOR UPDATE
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.annonce_copropriete_id(annonce_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) = 'SYNDIC')
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.annonce_copropriete_id(annonce_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) = 'SYNDIC')
  );

-- sondage : lecture = gestion ou audience d'un sondage OUVERT / CLOS ; écriture = syndic / conseil.
CREATE POLICY tenant_select ON "sondage" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR (statut IN ('OUVERT', 'CLOS') AND public.communication_audience_ok(audience, batiment, copropriete_id))
      )
    )
  );
CREATE POLICY tenant_write ON "sondage" FOR ALL
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL'))
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL'))
  );

-- sondage_reponse : chacun ne lit QUE la sienne (même le syndic : les résultats passent par
-- sondage_resultats()) ; une seule réponse, jamais modifiée ni supprimée.
CREATE POLICY tenant_select ON "sondage_reponse" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );
CREATE POLICY tenant_insert ON "sondage_reponse" FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (public.sondage_visible(sondage_id) AND utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );

-- contact_utile : lecture = tout membre du tenant ; écriture = syndic.
CREATE POLICY tenant_select ON "contact_utile" FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );
CREATE POLICY tenant_write ON "contact_utile" FOR ALL
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) = 'SYNDIC')
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND current_setting('app.current_role', true) = 'SYNDIC')
  );
