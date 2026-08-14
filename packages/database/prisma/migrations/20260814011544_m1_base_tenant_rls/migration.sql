-- CreateEnum
CREATE TYPE "TypeResidence" AS ENUM ('IMMEUBLE_COLLECTIF', 'RESIDENCE_FERMEE', 'RESIDENCE_VILLAS', 'IMMEUBLE_BUREAUX', 'IMMEUBLE_MIXTE', 'RESIDENCE_ETUDIANTE');

-- CreateEnum
CREATE TYPE "StatutCopropriete" AS ENUM ('ACTIVE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "StatutCompteUtilisateur" AS ENUM ('INVITE', 'EN_VALIDATION', 'ACTIF', 'SUSPENDU', 'DESACTIVE', 'ANONYMISE');

-- CreateEnum
CREATE TYPE "LanguePreferee" AS ENUM ('FR', 'AR');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SUPER_ADMIN', 'SYNDIC', 'CONSEIL_SYNDICAL', 'PROPRIETAIRE', 'LOCATAIRE', 'INDIVISAIRE', 'GARDIEN', 'PRESTATAIRE', 'PERSONNE_MORALE_REPRESENTANT');

-- CreateTable
CREATE TABLE "copropriete" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "type_residence" "TypeResidence" NOT NULL,
    "nb_lots" INTEGER NOT NULL,
    "date_creation" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutCopropriete" NOT NULL DEFAULT 'ACTIVE',
    "config_json" JSONB,
    "delai_convocation_jours" INTEGER,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "copropriete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT,
    "telephone" TEXT,
    "nom" TEXT,
    "prenom" TEXT,
    "langue_preferee" "LanguePreferee" NOT NULL DEFAULT 'FR',
    "statut_compte" "StatutCompteUtilisateur" NOT NULL DEFAULT 'INVITE',
    "raison_sociale" TEXT,
    "rc_numero" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_utilisateur" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "utilisateur_id" UUID NOT NULL,
    "copropriete_id" UUID NOT NULL,
    "role" "RoleType" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_telephone_key" ON "utilisateur"("telephone");

-- CreateIndex
CREATE INDEX "role_utilisateur_copropriete_id_idx" ON "role_utilisateur"("copropriete_id");

-- CreateIndex
CREATE INDEX "role_utilisateur_utilisateur_id_idx" ON "role_utilisateur"("utilisateur_id");

-- AddForeignKey
ALTER TABLE "role_utilisateur" ADD CONSTRAINT "role_utilisateur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_utilisateur" ADD CONSTRAINT "role_utilisateur_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS — écrit dans la MÊME migration que la création des tables (CLAUDE.md §1.8,
-- Master Spec Partie 2.3). Contexte injecté par apps/api/lib/tenant via SET LOCAL :
--   app.current_copropriete_id, app.current_role, app.current_user_id
-- (dérivés du JWT Supabase vérifié — jamais fournis par le client).
-- current_setting(..., true) retourne NULL si non défini → policy fermée par défaut.
-- ════════════════════════════════════════════════════════════════════════════

-- Rôle applicatif NOLOGIN (soumis à RLS — pas de BYPASSRLS). Chaque environnement crée son
-- propre rôle LOGIN membre de application_role (local : scripts/setup-local-app-role.ts ;
-- staging/prod : tâche ops, jamais de mot de passe dans une migration).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'application_role') THEN
    CREATE ROLE application_role NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO application_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "copropriete", "utilisateur", "role_utilisateur" TO application_role;

-- FORCE : même le propriétaire de la table est soumis aux policies (le rôle de migration
-- Supabase a BYPASSRLS et n'est pas affecté pour le seed/l'administration).
ALTER TABLE "copropriete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "copropriete" FORCE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur" FORCE ROW LEVEL SECURITY;
ALTER TABLE "role_utilisateur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_utilisateur" FORCE ROW LEVEL SECURITY;

-- Isolation tenant : la table copropriete EST le tenant (id = tenant id).
CREATE POLICY tenant_isolation ON "copropriete"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- Table globale (Master Spec Partie 1.6) : chacun se voit lui-même ; syndic/conseil syndical
-- voient les membres de LEUR copropriété uniquement (Doc A §12.3 — règles fines par rôle
-- affinées module par module).
CREATE POLICY utilisateur_visibilite ON "utilisateur"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR (
      current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
      AND EXISTS (
        SELECT 1 FROM "role_utilisateur" ru
        WHERE ru.utilisateur_id = "utilisateur".id
          AND ru.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      )
    )
  );

-- Isolation tenant + chacun voit ses propres rattachements (nécessaire pour résoudre la liste
-- de ses copropriétés à la connexion).
CREATE POLICY tenant_isolation ON "role_utilisateur"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

-- Contrainte Master Spec Partie 2.4 : un seul role='SYNDIC' actif=true par copropriété.
CREATE UNIQUE INDEX role_syndic_unique_actif ON "role_utilisateur" (copropriete_id)
  WHERE role = 'SYNDIC' AND actif = true;
