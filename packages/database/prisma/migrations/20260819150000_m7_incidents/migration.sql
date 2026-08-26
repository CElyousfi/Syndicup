-- ════════════════════════════════════════════════════════════════════════════
-- M7 — INCIDENTS, PERSONNEL, TIERS (Master Spec Partie 2.2, Doc A §5)
-- ════════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "CategorieIncident" AS ENUM ('PLOMBERIE', 'ELECTRICITE', 'ASCENSEUR', 'NETTOYAGE', 'SECURITE', 'STRUCTURE', 'JARDINS_ESPACES_VERTS', 'NUISANCES', 'PARKING', 'EQUIPEMENTS_COLLECTIFS', 'ADMINISTRATIF');
CREATE TYPE "PartieIncident" AS ENUM ('COMMUNE', 'PRIVATIVE');
CREATE TYPE "UrgenceIncident" AS ENUM ('NORMALE', 'URGENTE', 'URGENCE_MAXIMALE');
CREATE TYPE "StatutIncident" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'FERME');

-- CreateTable
CREATE TABLE "prestataire" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "specialite" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "utilisateur_id" UUID,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prestataire_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prestataire_utilisateur_id_key" ON "prestataire"("utilisateur_id");
CREATE INDEX "prestataire_copropriete_id_idx" ON "prestataire"("copropriete_id");
ALTER TABLE "prestataire" ADD CONSTRAINT "prestataire_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prestataire" ADD CONSTRAINT "prestataire_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "incident" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID,
    "categorie" "CategorieIncident" NOT NULL,
    "sous_categorie" TEXT NOT NULL,
    "description" TEXT,
    "partie" "PartieIncident" NOT NULL,
    "urgence" "UrgenceIncident" NOT NULL,
    "statut" "StatutIncident" NOT NULL DEFAULT 'OUVERT',
    "cree_par" UUID NOT NULL,
    "assigne_a" UUID,
    "sla_deadline" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "incident_copropriete_id_idx" ON "incident"("copropriete_id");
CREATE INDEX "incident_lot_id_idx" ON "incident"("lot_id");
ALTER TABLE "incident" ADD CONSTRAINT "incident_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident" ADD CONSTRAINT "incident_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident" ADD CONSTRAINT "incident_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident" ADD CONSTRAINT "incident_assigne_a_fkey" FOREIGN KEY ("assigne_a") REFERENCES "prestataire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable (append-only — historique complet, même discipline que audit_log)
CREATE TABLE "incident_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "incident_id" UUID NOT NULL,
    "statut_avant" "StatutIncident",
    "statut_apres" "StatutIncident" NOT NULL,
    "acteur_id" UUID,
    "commentaire" TEXT,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "incident_log_incident_id_idx" ON "incident_log"("incident_id");
ALTER TABLE "incident_log" ADD CONSTRAINT "incident_log_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident_log" ADD CONSTRAINT "incident_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions SECURITY DEFINER de dérivation tenant (même pattern que M3/M5 — casse la récursion
-- RLS pour les lookups inter-tables, même quand la dépendance n'est pas strictement cyclique,
-- par cohérence de style avec le reste du schéma).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.incident_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "incident" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.incident_cree_par(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT cree_par FROM "incident" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.incident_assigne_a(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT assigne_a FROM "incident" WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.prestataires_de(p_utilisateur_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM "prestataire" WHERE utilisateur_id = p_utilisateur_id;
$$;

REVOKE ALL ON FUNCTION public.incident_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.incident_cree_par FROM PUBLIC;
REVOKE ALL ON FUNCTION public.incident_assigne_a FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prestataires_de FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incident_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.incident_cree_par TO application_role;
GRANT EXECUTE ON FUNCTION public.incident_assigne_a TO application_role;
GRANT EXECUTE ON FUNCTION public.prestataires_de TO application_role;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTs / RLS
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON "prestataire", "incident" TO application_role;
GRANT SELECT, INSERT ON "incident_log" TO application_role;

ALTER TABLE "prestataire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prestataire" FORCE ROW LEVEL SECURITY;
ALTER TABLE "incident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident" FORCE ROW LEVEL SECURITY;
ALTER TABLE "incident_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_log" FORCE ROW LEVEL SECURITY;

-- prestataire : annuaire visible par syndic/conseil syndical/gardien (besoin opérationnel de
-- contacter un prestataire — Doc A §5.3) ; un prestataire voit sa propre fiche s'il a un compte.
CREATE POLICY tenant_isolation ON "prestataire"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

-- incident : confidentialité Master Spec Partie 4.2 / Doc A §12.3 — syndic/conseil
-- syndical/gardien voient tout ; un résident ne voit que les incidents QU'IL A CRÉÉS ("les
-- siens") ; un prestataire ne voit que les incidents qui lui sont assignés ("son ticket
-- d'intervention uniquement").
CREATE POLICY tenant_isolation ON "incident"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR cree_par = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR assigne_a IN (SELECT id FROM public.prestataires_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );

-- incident_log : même confidentialité que son incident parent, scopée via les fonctions ci-dessus.
CREATE POLICY tenant_isolation ON "incident_log"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.incident_copropriete_id(incident_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL', 'GARDIEN')
        OR public.incident_cree_par(incident_id) = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR public.incident_assigne_a(incident_id) IN (SELECT id FROM public.prestataires_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );
