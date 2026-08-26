-- ════════════════════════════════════════════════════════════════════════════
-- M6 — ASSEMBLÉES GÉNÉRALES (Master Spec Partie 2.2/8, Doc A §6)
-- ⚠️ Module légalement sensible — docs/LEGAL_QUESTIONS_BRIEF.md §0/§2/§4. Voir schema.prisma pour
-- le détail des paramètres légaux volontairement laissés NULL (jamais de valeur codée en dur).
-- ════════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "TypeAg" AS ENUM ('ORDINAIRE', 'EXTRAORDINAIRE', 'REVOCATION');
CREATE TYPE "StatutAg" AS ENUM ('PLANIFIEE', 'CONVOQUEE', 'EN_COURS', 'CLOTUREE', 'ANNULEE');
CREATE TYPE "TypeMajoriteAg" AS ENUM ('SIMPLE', 'DOUBLE', 'UNANIMITE');
CREATE TYPE "ResultatResolutionAg" AS ENUM ('EN_ATTENTE', 'ADOPTEE', 'REJETEE');
CREATE TYPE "ValeurVoteAg" AS ENUM ('POUR', 'CONTRE', 'ABSTENTION');

-- AlterTable — paramètres légaux nullables (voir schema.prisma pour justification complète)
ALTER TABLE "copropriete" ADD COLUMN "quorum_premiere_convocation" DECIMAL(4,3);
ALTER TABLE "copropriete" ADD COLUMN "limite_procurations_mandataire" INTEGER;

-- CreateTable
CREATE TABLE "assemblee_generale" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "type" "TypeAg" NOT NULL,
    "date_convocation" TIMESTAMPTZ,
    "date_ag" TIMESTAMPTZ NOT NULL,
    "statut" "StatutAg" NOT NULL DEFAULT 'PLANIFIEE',
    "quorum_requis" DECIMAL(4,3),
    "quorum_atteint" DECIMAL(4,3),
    "motif_annulation" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "assemblee_generale_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "assemblee_generale_copropriete_id_idx" ON "assemblee_generale"("copropriete_id");
ALTER TABLE "assemblee_generale" ADD CONSTRAINT "assemblee_generale_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ag_resolution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ag_id" UUID NOT NULL,
    "ordre" INTEGER NOT NULL,
    "texte" TEXT NOT NULL,
    "type_majorite" "TypeMajoriteAg" NOT NULL,
    "resultat" "ResultatResolutionAg" NOT NULL DEFAULT 'EN_ATTENTE',
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ag_resolution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ag_resolution_ag_id_idx" ON "ag_resolution"("ag_id");
ALTER TABLE "ag_resolution" ADD CONSTRAINT "ag_resolution_ag_id_fkey" FOREIGN KEY ("ag_id") REFERENCES "assemblee_generale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — Master Spec Partie 2.4)
CREATE TABLE "ag_vote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resolution_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "valeur" "ValeurVoteAg" NOT NULL,
    "tantiemes_representes" DECIMAL(14,2) NOT NULL,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ag_vote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ag_vote_resolution_id_lot_id_key" ON "ag_vote"("resolution_id", "lot_id");
CREATE INDEX "ag_vote_resolution_id_idx" ON "ag_vote"("resolution_id");
ALTER TABLE "ag_vote" ADD CONSTRAINT "ag_vote_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "ag_resolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ag_vote" ADD CONSTRAINT "ag_vote_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ag_vote" ADD CONSTRAINT "ag_vote_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ag_procuration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ag_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "mandant_id" UUID NOT NULL,
    "mandataire_id" UUID NOT NULL,
    "revoquee_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ag_procuration_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ag_procuration_ag_id_idx" ON "ag_procuration"("ag_id");
CREATE INDEX "ag_procuration_mandataire_id_idx" ON "ag_procuration"("mandataire_id");
ALTER TABLE "ag_procuration" ADD CONSTRAINT "ag_procuration_ag_id_fkey" FOREIGN KEY ("ag_id") REFERENCES "assemblee_generale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ag_procuration" ADD CONSTRAINT "ag_procuration_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ag_procuration" ADD CONSTRAINT "ag_procuration_mandant_id_fkey" FOREIGN KEY ("mandant_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ag_procuration" ADD CONSTRAINT "ag_procuration_mandataire_id_fkey" FOREIGN KEY ("mandataire_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — Master Spec Partie 2.4)
CREATE TABLE "ag_pv" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ag_id" UUID NOT NULL,
    "contenu_json" JSONB NOT NULL,
    "pdf_url" TEXT,
    "hash_integrite" TEXT NOT NULL,
    "horodatage_generation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ag_pv_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ag_pv_ag_id_key" ON "ag_pv"("ag_id");
ALTER TABLE "ag_pv" ADD CONSTRAINT "ag_pv_ag_id_fkey" FOREIGN KEY ("ag_id") REFERENCES "assemblee_generale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — preuve légale d'envoi, Doc A §12.2)
CREATE TABLE "ag_notification_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ag_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "canal" "CanalInvitation" NOT NULL,
    "horodatage_envoi" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accuse_reception_le" TIMESTAMPTZ,
    CONSTRAINT "ag_notification_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ag_notification_log_ag_id_idx" ON "ag_notification_log"("ag_id");
ALTER TABLE "ag_notification_log" ADD CONSTRAINT "ag_notification_log_ag_id_fkey" FOREIGN KEY ("ag_id") REFERENCES "assemblee_generale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ag_notification_log" ADD CONSTRAINT "ag_notification_log_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions SECURITY DEFINER de dérivation tenant (même pattern que M3/M5/M7).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ag_copropriete_id(p_ag_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "assemblee_generale" WHERE id = p_ag_id;
$$;

CREATE OR REPLACE FUNCTION public.ag_resolution_ag_id(p_resolution_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT ag_id FROM "ag_resolution" WHERE id = p_resolution_id;
$$;

-- Résultats agrégés d'une résolution (anonymisés — Doc A §12.3 : "vote anonymisé dans
-- l'affichage résident, mais tracé pour contestation judiciaire"). Callable par TOUT rôle
-- applicatif (résident inclus) sans exposer les lignes nominatives de `ag_vote` : bypasse la RLS
-- en interne (SECURITY DEFINER) mais ne retourne que des totaux, jamais utilisateur_id/lot_id.
CREATE OR REPLACE FUNCTION public.ag_resultats_resolution(p_resolution_id uuid)
RETURNS TABLE(valeur "ValeurVoteAg", nb_votants bigint, tantiemes_total numeric)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT valeur, COUNT(*)::bigint AS nb_votants, COALESCE(SUM(tantiemes_representes), 0)::numeric AS tantiemes_total
  FROM "ag_vote"
  WHERE resolution_id = p_resolution_id
  GROUP BY valeur;
$$;

REVOKE ALL ON FUNCTION public.ag_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ag_resolution_ag_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ag_resultats_resolution FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ag_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.ag_resolution_ag_id TO application_role;
GRANT EXECUTE ON FUNCTION public.ag_resultats_resolution TO application_role;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTs / RLS
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON "assemblee_generale", "ag_resolution", "ag_procuration" TO application_role;
GRANT SELECT, INSERT ON "ag_vote", "ag_pv", "ag_notification_log" TO application_role;

ALTER TABLE "assemblee_generale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assemblee_generale" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ag_resolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ag_resolution" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ag_vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ag_vote" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ag_procuration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ag_procuration" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ag_pv" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ag_pv" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ag_notification_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ag_notification_log" FORCE ROW LEVEL SECURITY;

-- assemblee_generale / ag_resolution : information copropriété-large, pas de confidentialité
-- fine — visible à tout membre du tenant (comme budget_ag/appel_de_fonds en M5).
CREATE POLICY tenant_isolation ON "assemblee_generale"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON "ag_resolution"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR public.ag_copropriete_id(ag_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- ag_vote : Doc A §12.3 — nominatif pour le syndic (audit), anonymisé pour le résident. La RLS
-- ne masque pas des COLONNES (impossible nativement) : elle limite l'accès direct aux LIGNES —
-- syndic/conseil syndical/super_admin voient tout ; un résident ne voit QUE ses propres votes en
-- lecture directe de table. Les résultats agrégés (ce que voit un résident dans l'UI) passent
-- exclusivement par `ag_resultats_resolution` (SECURITY DEFINER, ci-dessus), jamais par un SELECT
-- direct sur cette table.
CREATE POLICY tenant_isolation ON "ag_vote"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

-- ag_procuration : syndic voit tout (vérification à l'ouverture, Doc A §6.5) ; mandant/mandataire
-- voient leurs propres procurations.
CREATE POLICY tenant_isolation ON "ag_procuration"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.ag_copropriete_id(ag_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR mandant_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR mandataire_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

-- ag_pv : "Les PV sont accessibles à tous les copropriétaires" (Doc A §12.3) — pas de
-- confidentialité fine, visible à tout membre du tenant.
CREATE POLICY tenant_isolation ON "ag_pv"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR public.ag_copropriete_id(ag_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- ag_notification_log : preuve d'envoi — syndic voit tout ; chaque destinataire voit ses propres
-- accusés de réception (Doc A §12.2, "Résident conteste un vote... preuve de l'envoi").
CREATE POLICY tenant_isolation ON "ag_notification_log"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.ag_copropriete_id(ag_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
