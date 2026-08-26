-- ════════════════════════════════════════════════════════════════════════════
-- M8 — PARTIES COMMUNES (Master Spec Partie 2.2/9.4, Doc A §7)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE "StatutReservationEspaceCommun" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'REJETEE', 'ANNULEE');

-- AlterTable : voir schema.prisma pour la justification (Doc A §7.2 validation manuelle/auto).
ALTER TABLE "espace_commun" ADD COLUMN "validation_automatique" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "reservation_espace_commun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "espace_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "date_debut" TIMESTAMPTZ NOT NULL,
    "date_fin" TIMESTAMPTZ NOT NULL,
    "statut" "StatutReservationEspaceCommun" NOT NULL DEFAULT 'EN_ATTENTE',
    "nombre_invites" INTEGER,
    "motif_rejet" TEXT,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "reservation_espace_commun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservation_espace_commun_dates_check" CHECK ("date_fin" > "date_debut")
);
CREATE INDEX "reservation_espace_commun_espace_id_idx" ON "reservation_espace_commun"("espace_id");
CREATE INDEX "reservation_espace_commun_lot_id_idx" ON "reservation_espace_commun"("lot_id");
ALTER TABLE "reservation_espace_commun" ADD CONSTRAINT "reservation_espace_commun_espace_id_fkey" FOREIGN KEY ("espace_id") REFERENCES "espace_commun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_espace_commun" ADD CONSTRAINT "reservation_espace_commun_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_espace_commun" ADD CONSTRAINT "reservation_espace_commun_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "reservation_espace_commun" TO application_role;

ALTER TABLE "reservation_espace_commun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservation_espace_commun" FORCE ROW LEVEL SECURITY;

-- Planning d'occupation, pas une donnée confidentielle (contrairement aux impayés/votes) —
-- visible à tout membre du tenant, même logique que espace_commun lui-même (M3), pour permettre
-- la détection de conflit de créneau côté résident (Doc A §7.2) sans passer systématiquement par
-- le syndic.
CREATE POLICY tenant_isolation ON "reservation_espace_commun"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR public.lot_copropriete_id(lot_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );
