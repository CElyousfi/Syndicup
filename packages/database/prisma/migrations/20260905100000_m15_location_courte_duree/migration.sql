-- ════════════════════════════════════════════════════════════════════════════
-- M15 — LOCATION COURTE DURÉE (Doc A §10.2 « Résident loue sa villa via Airbnb »)
-- Périmètre copropriété uniquement : conformité au règlement (régime AUTORISEE / ENCADREE /
-- INTERDITE voté en AG), sécurité (qui est dans l'immeuble), nuisances. Aucune donnée
-- tarifaire. Les voyageurs n'ont jamais de compte (données minimales CNDP sur le séjour).
-- ⚠️ Ajouts signalés au-delà du Master Spec (CLAUDE.md §2) : RoleType.GESTIONNAIRE_LCD, les
-- enums Statut*/TypePieceIdentite/TypeEvenementSejour, les 3 tables et incident.sejour_id.
-- ════════════════════════════════════════════════════════════════════════════

-- AlterEnum — nouveau rôle scopé aux lots (jamais à la copropriété entière)
ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'GESTIONNAIRE_LCD';

-- CreateEnum
CREATE TYPE "RegimeLocationCourteDuree" AS ENUM ('NON_DEFINI', 'AUTORISEE', 'ENCADREE', 'INTERDITE');
CREATE TYPE "StatutDeclarationLcd" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'REFUSEE', 'SUSPENDUE', 'CLOTUREE');
CREATE TYPE "StatutSejour" AS ENUM ('PREVU', 'EN_COURS', 'TERMINE', 'ANNULE');
CREATE TYPE "TypePieceIdentite" AS ENUM ('CIN', 'PASSEPORT', 'TITRE_SEJOUR', 'AUTRE');
CREATE TYPE "TypeEvenementSejour" AS ENUM ('DECLARE', 'MODIFIE', 'ARRIVEE_CONFIRMEE', 'DEPART_CONFIRME', 'ANNULE', 'INCIDENT_LIE', 'GARDIEN_NOTIFIE');

-- AlterTable copropriete — régime LCD (NON_DEFINI tant que l'AG ne l'a pas fixé), paramètres
-- uniquement si ENCADREE (nullable : jamais de valeur légale devinée — LEGAL_QUESTIONS_BRIEF §7),
-- résolution d'AG facultative (le syndic peut enregistrer le règlement existant avant la 1re AG).
ALTER TABLE "copropriete" ADD COLUMN "regime_lcd" "RegimeLocationCourteDuree" NOT NULL DEFAULT 'NON_DEFINI';
ALTER TABLE "copropriete" ADD COLUMN "parametres_lcd_json" JSONB;
ALTER TABLE "copropriete" ADD COLUMN "regime_lcd_ag_resolution_id" UUID;
ALTER TABLE "copropriete" ADD CONSTRAINT "copropriete_regime_lcd_ag_resolution_id_fkey" FOREIGN KEY ("regime_lcd_ag_resolution_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable — déclaration « ce lot est exploité en LCD » (une par lot et par période)
CREATE TABLE "lot_location_courte_duree" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "declare_par_id" UUID NOT NULL,
    "gestionnaire_id" UUID,
    "plateformes_json" JSONB,
    "contact_urgence_nom" TEXT,
    "contact_urgence_telephone" TEXT,
    "statut" "StatutDeclarationLcd" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif_decision" TEXT,
    "decide_par_id" UUID,
    "decide_le" TIMESTAMPTZ,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "lot_location_courte_duree_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lot_location_courte_duree_copropriete_id_idx" ON "lot_location_courte_duree"("copropriete_id");
CREATE INDEX "lot_location_courte_duree_lot_id_idx" ON "lot_location_courte_duree"("lot_id");
CREATE INDEX "lot_location_courte_duree_gestionnaire_id_idx" ON "lot_location_courte_duree"("gestionnaire_id");
-- Au plus UNE déclaration ouverte (date_fin IS NULL) par lot.
CREATE UNIQUE INDEX "lot_location_courte_duree_lot_ouverte_key" ON "lot_location_courte_duree"("lot_id") WHERE "date_fin" IS NULL;
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_declare_par_id_fkey" FOREIGN KEY ("declare_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_gestionnaire_id_fkey" FOREIGN KEY ("gestionnaire_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_decide_par_id_fkey" FOREIGN KEY ("decide_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_dates_check" CHECK ("date_fin" IS NULL OR "date_fin" >= "date_debut");

-- CreateTable — séjour d'un voyageur (données minimales : pas de numéro de pièce complet, pas de scan)
CREATE TABLE "sejour_courte_duree" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "declaration_lcd_id" UUID NOT NULL,
    "declare_par_id" UUID NOT NULL,
    "date_arrivee" DATE NOT NULL,
    "date_depart" DATE NOT NULL,
    "heure_arrivee_prevue" TEXT,
    "nb_voyageurs" INTEGER NOT NULL,
    "voyageur_principal_nom" TEXT NOT NULL,
    "voyageur_telephone" TEXT,
    "voyageur_nationalite" TEXT,
    "piece_identite_type" "TypePieceIdentite",
    "piece_identite_fin" VARCHAR(4),
    "plaque_vehicule" TEXT,
    "statut" "StatutSejour" NOT NULL DEFAULT 'PREVU',
    "annule_le" TIMESTAMPTZ,
    "motif_annulation" TEXT,
    "gardien_informe_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "sejour_courte_duree_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sejour_courte_duree_dates_check" CHECK ("date_depart" > "date_arrivee"),
    CONSTRAINT "sejour_courte_duree_nb_voyageurs_check" CHECK ("nb_voyageurs" >= 1)
);
CREATE INDEX "sejour_courte_duree_copropriete_id_date_arrivee_idx" ON "sejour_courte_duree"("copropriete_id", "date_arrivee");
CREATE INDEX "sejour_courte_duree_lot_id_idx" ON "sejour_courte_duree"("lot_id");
CREATE INDEX "sejour_courte_duree_declaration_lcd_id_idx" ON "sejour_courte_duree"("declaration_lcd_id");
ALTER TABLE "sejour_courte_duree" ADD CONSTRAINT "sejour_courte_duree_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sejour_courte_duree" ADD CONSTRAINT "sejour_courte_duree_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sejour_courte_duree" ADD CONSTRAINT "sejour_courte_duree_declaration_lcd_id_fkey" FOREIGN KEY ("declaration_lcd_id") REFERENCES "lot_location_courte_duree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sejour_courte_duree" ADD CONSTRAINT "sejour_courte_duree_declare_par_id_fkey" FOREIGN KEY ("declare_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — qui était dans l'immeuble et quand : valeur probante, même
-- discipline que incident_log / audit_log : ni modifie_le, ni UPDATE, ni DELETE)
CREATE TABLE "sejour_evenement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "sejour_id" UUID NOT NULL,
    "type" "TypeEvenementSejour" NOT NULL,
    "acteur_id" UUID,
    "details_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sejour_evenement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sejour_evenement_sejour_id_idx" ON "sejour_evenement"("sejour_id");
CREATE INDEX "sejour_evenement_copropriete_id_idx" ON "sejour_evenement"("copropriete_id");
ALTER TABLE "sejour_evenement" ADD CONSTRAINT "sejour_evenement_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sejour_evenement" ADD CONSTRAINT "sejour_evenement_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejour_courte_duree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sejour_evenement" ADD CONSTRAINT "sejour_evenement_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable incident — « signalement facilité » : nuisance liée à un séjour (Doc A §10.2)
ALTER TABLE "incident" ADD COLUMN "sejour_id" UUID;
CREATE INDEX "incident_sejour_id_idx" ON "incident"("sejour_id");
ALTER TABLE "incident" ADD CONSTRAINT "incident_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejour_courte_duree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions SECURITY DEFINER (même pattern que M3/M7/M10) — lookups ciblés qui n'exposent que
-- des identifiants, pour scoper les policies sans récursion RLS.
-- ════════════════════════════════════════════════════════════════════════════

-- Lots dont l'utilisateur est propriétaire ACTIF (date_fin IS NULL) — plus strict que
-- lots_proprietaire_de (M3, qui inclut l'historique) : un ancien propriétaire ne voit pas les
-- séjours du nouveau. Nouvelle fonction : aucune policy existante n'est modifiée.
CREATE OR REPLACE FUNCTION public.lots_proprietaire_actif_de(p_utilisateur_id uuid)
RETURNS TABLE(lot_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "lot_proprietaire" WHERE utilisateur_id = p_utilisateur_id AND date_fin IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.lcd_declaration_gestionnaire_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT gestionnaire_id FROM "lot_location_courte_duree" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.lcd_declaration_statut(p_id uuid)
RETURNS "StatutDeclarationLcd"
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT statut FROM "lot_location_courte_duree" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.sejour_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "sejour_courte_duree" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.sejour_lot_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "sejour_courte_duree" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.sejour_declaration_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT declaration_lcd_id FROM "sejour_courte_duree" WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.lots_proprietaire_actif_de FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lcd_declaration_gestionnaire_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lcd_declaration_statut FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sejour_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sejour_lot_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sejour_declaration_id FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lots_proprietaire_actif_de TO application_role;
GRANT EXECUTE ON FUNCTION public.lcd_declaration_gestionnaire_id TO application_role;
GRANT EXECUTE ON FUNCTION public.lcd_declaration_statut TO application_role;
GRANT EXECUTE ON FUNCTION public.sejour_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.sejour_lot_id TO application_role;
GRANT EXECUTE ON FUNCTION public.sejour_declaration_id TO application_role;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTs / RLS
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON "lot_location_courte_duree", "sejour_courte_duree" TO application_role;
-- Append-only : ni UPDATE ni DELETE, même pour le syndic.
GRANT SELECT, INSERT ON "sejour_evenement" TO application_role;

ALTER TABLE "lot_location_courte_duree" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lot_location_courte_duree" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sejour_courte_duree" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sejour_courte_duree" FORCE ROW LEVEL SECURITY;
ALTER TABLE "sejour_evenement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sejour_evenement" FORCE ROW LEVEL SECURITY;

-- lot_location_courte_duree :
--   lecture  : syndic / conseil syndical (tout), propriétaire-indivisaire-représentant de
--              personne morale (lots où il est propriétaire ACTIF), gestionnaire LCD (ses
--              déclarations), gardien (déclarations VALIDEES uniquement — besoin opérationnel :
--              savoir quels lots accueillent des voyageurs). LOCATAIRE et voisins : rien.
--   écriture : syndic / conseil syndical, propriétaire actif du lot, gestionnaire désigné.
CREATE POLICY tenant_isolation ON "lot_location_courte_duree"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND lot_id IN (SELECT lot_id FROM public.lots_proprietaire_actif_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        )
        OR (
          current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
          AND gestionnaire_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
        OR (
          current_setting('app.current_role', true) = 'GARDIEN'
          AND statut = 'VALIDEE'
        )
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND lot_id IN (SELECT lot_id FROM public.lots_proprietaire_actif_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        )
        OR (
          current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
          AND gestionnaire_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  );

-- sejour_courte_duree : même visibilité que la déclaration parente (propriétaire actif du lot,
-- gestionnaire de la déclaration, syndic / conseil syndical) + gardien (tout séjour de sa
-- copropriété : il doit savoir qui arrive). L'identité d'un voyageur n'est pas pour l'immeuble :
-- les autres résidents ne voient rien. Le gardien peut ÉCRIRE (WITH CHECK) — le service API ne
-- lui laisse que les transitions PREVU→EN_COURS / EN_COURS→TERMINE, jamais les données voyageur.
CREATE POLICY tenant_isolation ON "sejour_courte_duree"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND lot_id IN (SELECT lot_id FROM public.lots_proprietaire_actif_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        )
        OR (
          current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
          AND public.lcd_declaration_gestionnaire_id(declaration_lcd_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND lot_id IN (SELECT lot_id FROM public.lots_proprietaire_actif_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        )
        OR (
          current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
          AND public.lcd_declaration_gestionnaire_id(declaration_lcd_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  );

-- sejour_evenement : append-only (aucune policy UPDATE/DELETE, GRANT SELECT+INSERT seulement),
-- visibilité = celle du séjour parent, scopée via les fonctions ci-dessus.
CREATE POLICY tenant_isolation ON "sejour_evenement"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND public.sejour_copropriete_id(sejour_id) = copropriete_id
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND public.sejour_lot_id(sejour_id) IN (SELECT lot_id FROM public.lots_proprietaire_actif_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        )
        OR (
          current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
          AND public.lcd_declaration_gestionnaire_id(public.sejour_declaration_id(sejour_id)) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  );

CREATE POLICY tenant_insert ON "sejour_evenement"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND public.sejour_copropriete_id(sejour_id) = copropriete_id
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND public.sejour_lot_id(sejour_id) IN (SELECT lot_id FROM public.lots_proprietaire_actif_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        )
        OR (
          current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
          AND public.lcd_declaration_gestionnaire_id(public.sejour_declaration_id(sejour_id)) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- Liaison du gestionnaire invité (M2) à la déclaration : à l'acceptation d'une invitation
-- GESTIONNAIRE_LCD (lot_id porté par l'invitation), le nouveau compte devient le gestionnaire de
-- la déclaration OUVERTE du lot si aucun n'est encore désigné. SECURITY DEFINER comme
-- invitation_accepter : le nouvel utilisateur ne voit pas encore la déclaration sous RLS.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.lcd_lier_gestionnaire_invitation(p_code text, p_utilisateur_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lot_id uuid;
  v_n integer;
BEGIN
  SELECT lot_id INTO v_lot_id FROM "invitation"
   WHERE code = p_code AND role_cible = 'GESTIONNAIRE_LCD' AND statut = 'ACCEPTEE' AND lot_id IS NOT NULL;
  IF v_lot_id IS NULL THEN RETURN false; END IF;
  UPDATE "lot_location_courte_duree"
     SET gestionnaire_id = p_utilisateur_id, modifie_le = now()
   WHERE lot_id = v_lot_id AND date_fin IS NULL AND gestionnaire_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.lcd_lier_gestionnaire_invitation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lcd_lier_gestionnaire_invitation TO application_role;
