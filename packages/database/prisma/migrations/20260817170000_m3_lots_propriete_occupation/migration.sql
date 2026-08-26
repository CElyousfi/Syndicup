-- CreateEnum
CREATE TYPE "TypeLot" AS ENUM ('APPARTEMENT', 'PARKING', 'CAVE', 'LOCAL', 'TOIT_TERRASSE', 'VILLA', 'COMMERCIAL', 'BUREAU', 'LOGE_GARDIEN');

-- CreateEnum
CREATE TYPE "StatutLot" AS ENUM ('OCCUPE', 'VACANT', 'ORPHELIN', 'EN_SUCCESSION', 'SINISTRE', 'TANTIEME_A_REGULARISER');

-- CreateEnum
CREATE TYPE "TypeUsageLot" AS ENUM ('HABITATION', 'BUREAU', 'MIXTE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "TypePropriete" AS ENUM ('PLEIN', 'INDIVISION', 'SCI');

-- CreateEnum
CREATE TYPE "TypeOccupation" AS ENUM ('PROPRIETAIRE_OCCUPANT', 'LOCATAIRE');

-- CreateEnum
CREATE TYPE "StatutSuccession" AS ENUM ('OUVERTE', 'HERITIERS_DESIGNES', 'CLOTUREE');

-- AlterTable : total des tantièmes défini au règlement de copropriété (voir schema.prisma pour
-- la justification — donnée opérationnelle propre à chaque copropriété, pas une valeur légale).
ALTER TABLE "copropriete" ADD COLUMN "total_tantiemes" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "lot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "type_lot" "TypeLot" NOT NULL,
    "type_usage" "TypeUsageLot",
    "numero" TEXT NOT NULL,
    "etage" INTEGER,
    "tantiemes" DECIMAL(14,2) NOT NULL,
    "superficie" DECIMAL(10,2),
    "statut" "StatutLot" NOT NULL DEFAULT 'VACANT',
    "lot_parent_id" UUID,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "espace_commun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacite" INTEGER,
    "reservable" BOOLEAN NOT NULL DEFAULT false,
    "regles_reservation_json" JSONB,

    CONSTRAINT "espace_commun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_proprietaire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "quote_part" DECIMAL(5,2) NOT NULL,
    "type_propriete" "TypePropriete" NOT NULL,
    "est_representant_indivision" BOOLEAN NOT NULL DEFAULT false,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,

    CONSTRAINT "lot_proprietaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_occupant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "type_occupation" "TypeOccupation" NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "acces_finances_accorde" BOOLEAN NOT NULL DEFAULT false,
    "recoit_convocations" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lot_occupant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "succession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "proprietaire_decede_id" UUID NOT NULL,
    "statut" "StatutSuccession" NOT NULL DEFAULT 'OUVERTE',
    "contact_temporaire_id" UUID,
    "date_ouverture" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "succession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lot_copropriete_id_idx" ON "lot"("copropriete_id");

-- CreateIndex
CREATE INDEX "espace_commun_copropriete_id_idx" ON "espace_commun"("copropriete_id");

-- CreateIndex
CREATE INDEX "lot_proprietaire_lot_id_idx" ON "lot_proprietaire"("lot_id");

-- CreateIndex
CREATE INDEX "lot_proprietaire_utilisateur_id_idx" ON "lot_proprietaire"("utilisateur_id");

-- CreateIndex
CREATE INDEX "lot_occupant_lot_id_idx" ON "lot_occupant"("lot_id");

-- CreateIndex
CREATE INDEX "lot_occupant_utilisateur_id_idx" ON "lot_occupant"("utilisateur_id");

-- CreateIndex
CREATE INDEX "succession_lot_id_idx" ON "succession"("lot_id");

-- AddForeignKey
ALTER TABLE "lot" ADD CONSTRAINT "lot_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot" ADD CONSTRAINT "lot_lot_parent_id_fkey" FOREIGN KEY ("lot_parent_id") REFERENCES "lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espace_commun" ADD CONSTRAINT "espace_commun_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_proprietaire" ADD CONSTRAINT "lot_proprietaire_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_proprietaire" ADD CONSTRAINT "lot_proprietaire_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_occupant" ADD CONSTRAINT "lot_occupant_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_occupant" ADD CONSTRAINT "lot_occupant_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "succession" ADD CONSTRAINT "succession_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (invitation.lot_id — placeholder UUID brut depuis M2, la table lot existe désormais)
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS — même migration que la création des tables (CLAUDE.md §1.8).
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON "lot", "espace_commun", "lot_proprietaire", "lot_occupant", "succession" TO application_role;

ALTER TABLE "lot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "espace_commun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "espace_commun" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lot_proprietaire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lot_proprietaire" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lot_occupant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lot_occupant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "succession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "succession" FORCE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions SECURITY DEFINER de support RLS. Les policies de `lot`, `lot_proprietaire`,
-- `lot_occupant` et `succession` se référencent mutuellement (ex. la policy de `lot` filtre sur
-- `lot_proprietaire`, et la policy de `lot_proprietaire` filtre sur `lot`) : une sous-requête
-- directe entre deux tables RLS qui se référencent l'une l'autre provoque une récursion infinie
-- (Postgres 42P17). Le contournement standard est de faire passer CHAQUE lookup inter-tables par
-- une fonction SECURITY DEFINER (propriétaire = rôle de migration, BYPASSRLS) qui exécute sa
-- requête hors RLS, sans jamais réévaluer la policy de la table appelante ou d'une autre table
-- RLS'ée dans le même cycle.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lot_copropriete_id(p_lot_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "lot" WHERE id = p_lot_id;
$$;

CREATE OR REPLACE FUNCTION public.lots_proprietaire_de(p_utilisateur_id uuid)
RETURNS TABLE(lot_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "lot_proprietaire" WHERE utilisateur_id = p_utilisateur_id;
$$;

CREATE OR REPLACE FUNCTION public.lots_occupant_de(p_utilisateur_id uuid)
RETURNS TABLE(lot_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "lot_occupant" WHERE utilisateur_id = p_utilisateur_id;
$$;

REVOKE ALL ON FUNCTION public.lot_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lots_proprietaire_de FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lots_occupant_de FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lot_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.lots_proprietaire_de TO application_role;
GRANT EXECUTE ON FUNCTION public.lots_occupant_de TO application_role;

-- lot : isolation tenant + confidentialité (Doc A §12.3) — syndic/conseil syndical/gardien
-- voient tous les lots de leur copropriété ; les autres rôles ne voient que les lots où ils sont
-- propriétaire ou occupant. Limite connue : PERSONNE_MORALE_REPRESENTANT n'est pas résolu ici
-- (Doc A §2.7, explicitement reportable en Phase 2 — voir ROADMAP_BACKLOG.md).
CREATE POLICY tenant_isolation ON "lot"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR id IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- espace_commun : liste des équipements communs, pas sensible — visible à tout membre du tenant.
CREATE POLICY tenant_isolation ON "espace_commun"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- lot_proprietaire : syndic/conseil syndical voient tout dans leur copropriété ; un indivisaire
-- voit les autres co-indivisaires de SON lot (Doc A §2.4) ; sinon on ne voit que sa propre ligne.
CREATE POLICY tenant_isolation ON "lot_proprietaire"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- lot_occupant : syndic/conseil syndical voient tout ; le propriétaire du lot voit son
-- locataire (Doc A §2.2) ; sinon on ne voit que sa propre ligne.
CREATE POLICY tenant_isolation ON "lot_occupant"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- succession : donnée sensible (décès) — syndic/conseil syndical, ou les parties directement
-- concernées (défunt, contact temporaire — Doc A §2.5, §12.1).
CREATE POLICY tenant_isolation ON "succession"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR proprietaire_decede_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR contact_temporaire_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- Contrainte Master Spec Partie 2.4 / Doc A §2.4 : la somme des quote_part ACTIVES
-- (date_fin IS NULL) d'un même lot doit être 100%. Contrainte trigger DEFERRABLE INITIALLY
-- DEFERRED (vérifiée à la fin de la transaction) pour permettre d'insérer plusieurs lignes
-- d'indivision dans la même transaction sans violation intermédiaire.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lot_proprietaire_check_quote_part()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_lot_id uuid;
  v_somme numeric(7,2);
BEGIN
  v_lot_id := COALESCE(NEW.lot_id, OLD.lot_id);

  SELECT COALESCE(SUM(quote_part), 0) INTO v_somme
  FROM "lot_proprietaire"
  WHERE lot_id = v_lot_id AND date_fin IS NULL;

  IF v_somme <> 0 AND v_somme <> 100 THEN
    RAISE EXCEPTION 'Somme des quote_part actives du lot % = % (doit être 100, Master Spec Partie 2.4 / Doc A §2.4).', v_lot_id, v_somme
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER lot_proprietaire_quote_part_check
  AFTER INSERT OR UPDATE OR DELETE ON "lot_proprietaire"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.lot_proprietaire_check_quote_part();

-- ════════════════════════════════════════════════════════════════════════════
-- Contrainte Master Spec Partie 2.4 : la somme des tantièmes d'une copropriété ne doit jamais
-- dépasser le total défini au règlement (copropriete.total_tantiemes). Bloquant dès que ce
-- champ est renseigné par le syndic ; pas de blocage tant qu'il est NULL (voir schema.prisma).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lot_check_total_tantiemes()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_total_regle numeric(14,2);
  v_somme numeric(14,2);
BEGIN
  SELECT total_tantiemes INTO v_total_regle FROM "copropriete" WHERE id = NEW.copropriete_id;

  IF v_total_regle IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(tantiemes), 0) INTO v_somme FROM "lot" WHERE copropriete_id = NEW.copropriete_id;

  IF v_somme > v_total_regle THEN
    RAISE EXCEPTION 'Somme des tantièmes de la copropriété % (%) dépasse le total défini au règlement (%) — Master Spec Partie 2.4.', NEW.copropriete_id, v_somme, v_total_regle
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER lot_total_tantiemes_check
  AFTER INSERT OR UPDATE OF tantiemes, copropriete_id ON "lot"
  FOR EACH ROW EXECUTE FUNCTION public.lot_check_total_tantiemes();
