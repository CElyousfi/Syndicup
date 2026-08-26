-- ════════════════════════════════════════════════════════════════════════════
-- M10 — PERSONNEL / GARDIEN & VISITES (Master Spec Partie 2.2/13.3, Doc A §9)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE "StatutPersonnel" AS ENUM ('PRESENT', 'ABSENT', 'REMPLACE');
CREATE TYPE "StatutVisite" AS ENUM ('EN_ATTENTE', 'AUTORISE', 'REFUSE');

-- CreateTable
CREATE TABLE "personnel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "utilisateur_id" UUID NOT NULL,
    "copropriete_id" UUID NOT NULL,
    "statut" "StatutPersonnel" NOT NULL DEFAULT 'PRESENT',
    "logement_lot_id" UUID,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personnel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "personnel_utilisateur_id_copropriete_id_key" ON "personnel"("utilisateur_id", "copropriete_id");
CREATE INDEX "personnel_copropriete_id_idx" ON "personnel"("copropriete_id");
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_logement_lot_id_fkey" FOREIGN KEY ("logement_lot_id") REFERENCES "lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable : Doc A §9.2 "Module visites : Gardien enregistre → notification push au résident →
-- Résident autorise ou refuse → Gardien reçoit la réponse".
CREATE TABLE "visite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "gardien_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "visiteur_nom" TEXT NOT NULL,
    "statut" "StatutVisite" NOT NULL DEFAULT 'EN_ATTENTE',
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "visite_copropriete_id_idx" ON "visite"("copropriete_id");
CREATE INDEX "visite_lot_id_idx" ON "visite"("lot_id");
ALTER TABLE "visite" ADD CONSTRAINT "visite_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visite" ADD CONSTRAINT "visite_gardien_id_fkey" FOREIGN KEY ("gardien_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visite" ADD CONSTRAINT "visite_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "personnel" TO application_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "visite" TO application_role;

ALTER TABLE "personnel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personnel" FORCE ROW LEVEL SECURITY;
ALTER TABLE "visite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visite" FORCE ROW LEVEL SECURITY;

-- Lecture ouverte à tout membre du tenant (la fiche gardien — présence, logement — est une
-- information de fonctionnement de la résidence, Doc A §9 "fiche d'urgence" visible des
-- résidents) ; écriture réservée au syndic (permission applicative `personnel.gerer`).
CREATE POLICY tenant_isolation ON "personnel"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) = 'SYNDIC'
    )
  );

-- Confidentialité (Doc A §12.3) : un résident ne voit que les visites de ses propres lots
-- (fonctions SECURITY DEFINER lots_proprietaire_de/lots_occupant_de créées en M3), le gardien
-- ne voit que celles qu'il a enregistrées, syndic/conseil syndical supervisent tout.
-- WITH CHECK : INSERT par gardien/syndic, UPDATE (autorise/refuse) par le résident du lot —
-- une seule policy couvre les deux cas.
CREATE POLICY tenant_isolation ON "visite"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR gardien_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR lot_id IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'GARDIEN')
        OR lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
        OR lot_id IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
      )
    )
  );
