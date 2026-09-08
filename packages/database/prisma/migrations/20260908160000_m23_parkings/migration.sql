-- CreateEnum
CREATE TYPE "TypeEmplacement" AS ENUM ('PARKING_COMMUN', 'PARKING_VISITEUR', 'PARKING_PMR', 'MOTO', 'VELO', 'CAVE_COMMUNE');

-- CreateEnum
CREATE TYPE "StatutEmplacement" AS ENUM ('DISPONIBLE', 'ATTRIBUE', 'HORS_SERVICE');

-- CreateEnum
CREATE TYPE "TypeAttributionEmplacement" AS ENUM ('ATTRIBUTION_AG', 'ROTATION', 'LOCATION_INTERNE', 'TEMPORAIRE');

-- CreateEnum
CREATE TYPE "TypeVehicule" AS ENUM ('VOITURE', 'MOTO', 'UTILITAIRE');

-- CreateEnum
CREATE TYPE "TypeBadge" AS ENUM ('BADGE_PIETON', 'TELECOMMANDE_PARKING', 'CLE_CAVE', 'CARTE_ASCENSEUR');

-- CreateEnum
CREATE TYPE "StatutBadge" AS ENUM ('ACTIF', 'PERDU', 'DESACTIVE', 'RESTITUE');

-- AlterEnum
ALTER TYPE "TypeAppelDeFonds" ADD VALUE 'REDEVANCE_PARKING';

-- AlterTable
ALTER TABLE "incident" ADD COLUMN     "emplacement_id" UUID,
ADD COLUMN     "immatriculation_signalee" TEXT;

-- AlterTable
ALTER TABLE "sejour_courte_duree" ADD COLUMN     "emplacement_id" UUID;

-- AlterTable
ALTER TABLE "visite" ADD COLUMN     "emplacement_id" UUID,
ADD COLUMN     "heure_limite" TIMESTAMPTZ,
ADD COLUMN     "immatriculation" TEXT;

-- CreateTable
CREATE TABLE "emplacement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "type" "TypeEmplacement" NOT NULL,
    "code" TEXT NOT NULL,
    "niveau" TEXT,
    "attribuable" BOOLEAN NOT NULL DEFAULT true,
    "statut" "StatutEmplacement" NOT NULL DEFAULT 'DISPONIBLE',
    "notes" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "emplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribution_emplacement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "emplacement_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "type" "TypeAttributionEmplacement" NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "resolution_ag_id" UUID,
    "redevance_mensuelle" DECIMAL(14,2),
    "notes" TEXT,
    "expiree_notifiee_le" TIMESTAMPTZ,
    "cree_par_id" UUID,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attribution_emplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "utilisateur_id" UUID,
    "immatriculation" TEXT NOT NULL,
    "marque" TEXT,
    "couleur" TEXT,
    "type" "TypeVehicule" NOT NULL DEFAULT 'VOITURE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "type" "TypeBadge" NOT NULL,
    "identifiant" TEXT NOT NULL,
    "statut" "StatutBadge" NOT NULL DEFAULT 'ACTIF',
    "remis_le" DATE NOT NULL,
    "remis_par_id" UUID,
    "restitue_le" DATE,
    "caution_montant" DECIMAL(14,2),
    "caution_paiement_id" UUID,
    "notes" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emplacement_copropriete_id_type_niveau_idx" ON "emplacement"("copropriete_id", "type", "niveau");

-- CreateIndex
CREATE UNIQUE INDEX "emplacement_copropriete_id_code_key" ON "emplacement"("copropriete_id", "code");

-- CreateIndex
CREATE INDEX "attribution_emplacement_emplacement_id_date_debut_idx" ON "attribution_emplacement"("emplacement_id", "date_debut");

-- CreateIndex
CREATE INDEX "attribution_emplacement_lot_id_idx" ON "attribution_emplacement"("lot_id");

-- CreateIndex
CREATE INDEX "vehicule_lot_id_idx" ON "vehicule"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicule_copropriete_id_immatriculation_key" ON "vehicule"("copropriete_id", "immatriculation");

-- CreateIndex
CREATE INDEX "badge_lot_id_idx" ON "badge"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "badge_copropriete_id_type_identifiant_key" ON "badge"("copropriete_id", "type", "identifiant");

-- AddForeignKey
ALTER TABLE "visite" ADD CONSTRAINT "visite_emplacement_id_fkey" FOREIGN KEY ("emplacement_id") REFERENCES "emplacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_emplacement_id_fkey" FOREIGN KEY ("emplacement_id") REFERENCES "emplacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sejour_courte_duree" ADD CONSTRAINT "sejour_courte_duree_emplacement_id_fkey" FOREIGN KEY ("emplacement_id") REFERENCES "emplacement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emplacement" ADD CONSTRAINT "emplacement_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_emplacement" ADD CONSTRAINT "attribution_emplacement_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_emplacement" ADD CONSTRAINT "attribution_emplacement_emplacement_id_fkey" FOREIGN KEY ("emplacement_id") REFERENCES "emplacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_emplacement" ADD CONSTRAINT "attribution_emplacement_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_emplacement" ADD CONSTRAINT "attribution_emplacement_resolution_ag_id_fkey" FOREIGN KEY ("resolution_ag_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_emplacement" ADD CONSTRAINT "attribution_emplacement_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicule" ADD CONSTRAINT "vehicule_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicule" ADD CONSTRAINT "vehicule_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicule" ADD CONSTRAINT "vehicule_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_remis_par_id_fkey" FOREIGN KEY ("remis_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_caution_paiement_id_fkey" FOREIGN KEY ("caution_paiement_id") REFERENCES "paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- M23 — PARKINGS : contraintes, fonctions (SECURITY DEFINER), RLS.
-- Lecture : syndic / conseil / gardien tout ; résidents = leurs lots (attributions, véhicules, badges).
-- Écriture : syndic ; les résidents déclarent les véhicules de LEURS lots.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "emplacement"
  ADD CONSTRAINT emplacement_code_check CHECK (char_length(code) BETWEEN 1 AND 30);
ALTER TABLE "attribution_emplacement"
  ADD CONSTRAINT attribution_dates_check CHECK (date_fin IS NULL OR date_fin >= date_debut),
  ADD CONSTRAINT attribution_redevance_check CHECK (redevance_mensuelle IS NULL OR redevance_mensuelle >= 0);
ALTER TABLE "vehicule"
  ADD CONSTRAINT vehicule_immatriculation_check CHECK (immatriculation ~ '^[A-Z0-9-]{2,20}$');
ALTER TABLE "badge"
  ADD CONSTRAINT badge_identifiant_check CHECK (char_length(identifiant) BETWEEN 1 AND 60),
  ADD CONSTRAINT badge_caution_check CHECK (caution_montant IS NULL OR caution_montant >= 0),
  ADD CONSTRAINT badge_restitue_check CHECK (statut <> 'RESTITUE' OR restitue_le IS NOT NULL);

-- Lots dont l'utilisateur courant est propriétaire actif ou occupant en cours (résidents).
CREATE OR REPLACE FUNCTION public.lots_du_resident_courant()
RETURNS TABLE(lot_id uuid) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "lot_proprietaire" WHERE utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND date_fin IS NULL
  UNION
  SELECT lot_id FROM "lot_occupant" WHERE utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid AND date_fin IS NULL;
$$;
REVOKE ALL ON FUNCTION public.lots_du_resident_courant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lots_du_resident_courant() TO application_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON "emplacement", "attribution_emplacement", "vehicule", "badge" TO application_role;

ALTER TABLE "emplacement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emplacement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "attribution_emplacement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attribution_emplacement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "vehicule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicule" FORCE ROW LEVEL SECURITY;
ALTER TABLE "badge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "badge" FORCE ROW LEVEL SECURITY;

-- emplacement : le plan est lisible de tout membre du tenant (codes non sensibles) ; écriture syndic.
CREATE POLICY tenant_select ON "emplacement" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid);
CREATE POLICY tenant_write ON "emplacement" FOR ALL
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'))
  WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'));

-- attribution : syndic / conseil / gardien tout ; résident ses lots ; écriture syndic.
CREATE POLICY tenant_select ON "attribution_emplacement" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
             OR lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()))));
CREATE POLICY tenant_write ON "attribution_emplacement" FOR ALL
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'))
  WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'));

-- vehicule : gardien / syndic / conseil tout (contrôle d'accès) ; résident ses lots (lecture ET écriture).
CREATE POLICY tenant_select ON "vehicule" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
             OR lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()))));
CREATE POLICY tenant_write ON "vehicule" FOR ALL
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) = 'SYNDIC' OR lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()))))
  WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) = 'SYNDIC' OR lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()))));

-- badge : syndic / conseil / gardien tout ; résident ses lots ; écriture syndic.
CREATE POLICY tenant_select ON "badge" FOR SELECT
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
        AND (current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
             OR lot_id IN (SELECT lot_id FROM public.lots_du_resident_courant()))));
CREATE POLICY tenant_write ON "badge" FOR ALL
  USING (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'))
  WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AND current_setting('app.current_role', true) = 'SYNDIC'));
