-- ════════════════════════════════════════════════════════════════════════════
-- M5 — MOTEUR FINANCIER (Master Spec Partie 2.2/6, Doc A §3)
-- ════════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "StatutBudgetAg" AS ENUM ('PROPOSE', 'VOTE', 'ACTIF');
CREATE TYPE "TypeAppelDeFonds" AS ENUM ('CHARGES_COURANTES', 'EXCEPTIONNEL', 'FONDS_RESERVE', 'REGULARISATION', 'URGENCE', 'DEMARRAGE');
CREATE TYPE "StatutAppelDeFonds" AS ENUM ('BROUILLON', 'EMIS', 'CLOTURE');
CREATE TYPE "StatutAppelDeFondsLot" AS ENUM ('PAYE', 'PARTIEL', 'IMPAYE');
CREATE TYPE "MethodePaiement" AS ENUM ('CMI', 'VIREMENT', 'ESPECES', 'CHEQUE');
CREATE TYPE "StatutPaiement" AS ENUM ('VALIDE', 'EN_ATTENTE', 'REJETE');
CREATE TYPE "StatutContestationCharge" AS ENUM ('OUVERTE', 'REPONDUE', 'MEDIEE', 'TRIBUNAL');
CREATE TYPE "NiveauEscalade" AS ENUM ('N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6');
CREATE TYPE "TypeMouvementFondsReserve" AS ENUM ('COTISATION', 'DEPENSE');

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN "politique_recouvrement_json" JSONB;

-- CreateTable
CREATE TABLE "budget_ag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "ag_id" UUID,
    "exercice" TEXT NOT NULL,
    "montant_total" DECIMAL(14,2) NOT NULL,
    "statut" "StatutBudgetAg" NOT NULL DEFAULT 'PROPOSE',
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "budget_ag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "budget_ag_copropriete_id_idx" ON "budget_ag"("copropriete_id");
ALTER TABLE "budget_ag" ADD CONSTRAINT "budget_ag_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "appel_de_fonds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "periode" TEXT NOT NULL,
    "type" "TypeAppelDeFonds" NOT NULL,
    "montant_total" DECIMAL(14,2) NOT NULL,
    "date_echeance" DATE NOT NULL,
    "statut" "StatutAppelDeFonds" NOT NULL DEFAULT 'BROUILLON',
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "appel_de_fonds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "appel_de_fonds_copropriete_id_periode_type_key" ON "appel_de_fonds"("copropriete_id", "periode", "type");
CREATE INDEX "appel_de_fonds_copropriete_id_idx" ON "appel_de_fonds"("copropriete_id");
ALTER TABLE "appel_de_fonds" ADD CONSTRAINT "appel_de_fonds_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "appel_de_fonds_lot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appel_de_fonds_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "montant_du" DECIMAL(14,2) NOT NULL,
    "montant_paye" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "statut" "StatutAppelDeFondsLot" NOT NULL DEFAULT 'IMPAYE',
    "trop_percu_autorise" BOOLEAN NOT NULL DEFAULT false,
    "conteste" BOOLEAN NOT NULL DEFAULT false,
    "niveau_escalade" "NiveauEscalade" NOT NULL DEFAULT 'N0',
    "derniere_escalade_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "appel_de_fonds_lot_pkey" PRIMARY KEY ("id"),
    -- Master Spec Partie 2.4 : "montant_paye ≤ montant_du sauf trop-perçu explicitement flaggé".
    CONSTRAINT "appel_de_fonds_lot_montant_paye_check" CHECK ("montant_paye" <= "montant_du" OR "trop_percu_autorise" = true)
);
CREATE UNIQUE INDEX "appel_de_fonds_lot_appel_de_fonds_id_lot_id_key" ON "appel_de_fonds_lot"("appel_de_fonds_id", "lot_id");
CREATE INDEX "appel_de_fonds_lot_lot_id_idx" ON "appel_de_fonds_lot"("lot_id");
ALTER TABLE "appel_de_fonds_lot" ADD CONSTRAINT "appel_de_fonds_lot_appel_de_fonds_id_fkey" FOREIGN KEY ("appel_de_fonds_id") REFERENCES "appel_de_fonds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appel_de_fonds_lot" ADD CONSTRAINT "appel_de_fonds_lot_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — Master Spec Partie 2.4)
CREATE TABLE "paiement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lot_id" UUID NOT NULL,
    "appel_de_fonds_lot_id" UUID NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "methode" "MethodePaiement" NOT NULL,
    "reference_cmi" TEXT,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'VALIDE',
    "payeur_utilisateur_id" UUID,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paiement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "paiement_reference_cmi_key" ON "paiement"("reference_cmi");
CREATE INDEX "paiement_lot_id_idx" ON "paiement"("lot_id");
CREATE INDEX "paiement_appel_de_fonds_lot_id_idx" ON "paiement"("appel_de_fonds_lot_id");
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_appel_de_fonds_lot_id_fkey" FOREIGN KEY ("appel_de_fonds_lot_id") REFERENCES "appel_de_fonds_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_payeur_utilisateur_id_fkey" FOREIGN KEY ("payeur_utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "fonds_reserve" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fonds_reserve_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fonds_reserve_copropriete_id_key" ON "fonds_reserve"("copropriete_id");
ALTER TABLE "fonds_reserve" ADD CONSTRAINT "fonds_reserve_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — Master Spec Partie 6.5)
CREATE TABLE "fonds_reserve_mouvement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fonds_reserve_id" UUID NOT NULL,
    "type" "TypeMouvementFondsReserve" NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "resolution_ag_id" UUID,
    "description" TEXT,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fonds_reserve_mouvement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fonds_reserve_mouvement_fonds_reserve_id_idx" ON "fonds_reserve_mouvement"("fonds_reserve_id");
ALTER TABLE "fonds_reserve_mouvement" ADD CONSTRAINT "fonds_reserve_mouvement_fonds_reserve_id_fkey" FOREIGN KEY ("fonds_reserve_id") REFERENCES "fonds_reserve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — preuve fiscale, rétention 10 ans, Master Spec Partie 9)
CREATE TABLE "quittance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appel_de_fonds_lot_id" UUID NOT NULL,
    "pdf_url" TEXT,
    "numero" TEXT NOT NULL,
    "date_emission" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quittance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quittance_appel_de_fonds_lot_id_key" ON "quittance"("appel_de_fonds_lot_id");
CREATE UNIQUE INDEX "quittance_numero_key" ON "quittance"("numero");
ALTER TABLE "quittance" ADD CONSTRAINT "quittance_appel_de_fonds_lot_id_fkey" FOREIGN KEY ("appel_de_fonds_lot_id") REFERENCES "appel_de_fonds_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "contestation_charge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appel_de_fonds_lot_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutContestationCharge" NOT NULL DEFAULT 'OUVERTE',
    "reponse_syndic" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "contestation_charge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contestation_charge_appel_de_fonds_lot_id_idx" ON "contestation_charge"("appel_de_fonds_lot_id");
ALTER TABLE "contestation_charge" ADD CONSTRAINT "contestation_charge_appel_de_fonds_lot_id_fkey" FOREIGN KEY ("appel_de_fonds_lot_id") REFERENCES "appel_de_fonds_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contestation_charge" ADD CONSTRAINT "contestation_charge_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions SECURITY DEFINER de dérivation tenant (même pattern que M3 — casse la récursion
-- RLS pour les tables scoping via lot_id/appel_de_fonds_id plutôt que copropriete_id direct).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.appel_de_fonds_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "appel_de_fonds" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.appel_de_fonds_lot_lot_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "appel_de_fonds_lot" WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.appel_de_fonds_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appel_de_fonds_lot_lot_id FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.appel_de_fonds_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.appel_de_fonds_lot_lot_id TO application_role;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTs — tables mutables normales vs tables append-only (CLAUDE.md §1 non-négociable n°2 :
-- paiement et fonds_reserve_mouvement sont explicitement append-only au Master Spec ; quittance
-- et fonds_reserve suivent la même discipline par extension conservatrice — pas de colonne
-- mutable de toute façon pour fonds_reserve, et valeur probante fiscale pour quittance).
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_ag", "appel_de_fonds", "appel_de_fonds_lot", "contestation_charge" TO application_role;
GRANT SELECT, INSERT ON "paiement", "fonds_reserve", "fonds_reserve_mouvement", "quittance" TO application_role;

ALTER TABLE "budget_ag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_ag" FORCE ROW LEVEL SECURITY;
ALTER TABLE "appel_de_fonds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appel_de_fonds" FORCE ROW LEVEL SECURITY;
ALTER TABLE "appel_de_fonds_lot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appel_de_fonds_lot" FORCE ROW LEVEL SECURITY;
ALTER TABLE "paiement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paiement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fonds_reserve" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fonds_reserve" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fonds_reserve_mouvement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fonds_reserve_mouvement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quittance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quittance" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contestation_charge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contestation_charge" FORCE ROW LEVEL SECURITY;

-- budget_ag / appel_de_fonds : montants agrégés, pas par lot — visibles à tout membre du tenant
-- (transparence budgétaire), pas de confidentialité fine nécessaire à ce niveau.
CREATE POLICY tenant_isolation ON "budget_ag"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON "appel_de_fonds"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- appel_de_fonds_lot : confidentialité stricte (Master Spec Partie 2.3, exemple littéral
-- "impaye_confidentiel") — syndic/conseil syndical voient tout ; un résident ne voit que les
-- lignes de son propre lot (propriétaire ou occupant).
CREATE POLICY tenant_isolation ON "appel_de_fonds_lot"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR lot_id IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- paiement : même confidentialité, scopée via appel_de_fonds_lot_lot_id.
CREATE POLICY tenant_isolation ON "paiement"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR lot_id IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- quittance : même confidentialité, scopée via appel_de_fonds_lot_id → lot_id.
CREATE POLICY tenant_isolation ON "quittance"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(public.appel_de_fonds_lot_lot_id(appel_de_fonds_lot_id)) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR public.appel_de_fonds_lot_lot_id(appel_de_fonds_lot_id) IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR public.appel_de_fonds_lot_lot_id(appel_de_fonds_lot_id) IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- contestation_charge : syndic/conseil voient tout ; l'auteur de la contestation voit la sienne ;
-- le(s) propriétaire(s)/occupant(s) du lot concerné la voient aussi (Doc A §12.1).
CREATE POLICY tenant_isolation ON "contestation_charge"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.lot_copropriete_id(public.appel_de_fonds_lot_lot_id(appel_de_fonds_lot_id)) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR public.appel_de_fonds_lot_lot_id(appel_de_fonds_lot_id) IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR public.appel_de_fonds_lot_lot_id(appel_de_fonds_lot_id) IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- fonds_reserve / fonds_reserve_mouvement : trésorerie sensible (Doc A §12.1, cas "syndic
-- disparaît avec la trésorerie") — restreint à syndic/conseil syndical, PAS de lecture résident
-- par défaut (extension conservatrice au-delà du Master Spec littéral qui ne précise pas la
-- policy exacte pour ces deux tables — à revoir si le produit veut une transparence plus large).
CREATE POLICY tenant_isolation ON "fonds_reserve"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

CREATE OR REPLACE FUNCTION public.fonds_reserve_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "fonds_reserve" WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.fonds_reserve_copropriete_id FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fonds_reserve_copropriete_id TO application_role;

CREATE POLICY tenant_isolation ON "fonds_reserve_mouvement"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.fonds_reserve_copropriete_id(fonds_reserve_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );
