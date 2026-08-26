-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_acteur_id_fkey";

-- DropForeignKey
ALTER TABLE "contestation_charge" DROP CONSTRAINT "contestation_charge_utilisateur_id_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_assigne_a_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_lot_id_fkey";

-- DropForeignKey
ALTER TABLE "incident_log" DROP CONSTRAINT "incident_log_acteur_id_fkey";

-- DropForeignKey
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_lot_id_fkey";

-- DropForeignKey
ALTER TABLE "paiement" DROP CONSTRAINT "paiement_payeur_utilisateur_id_fkey";

-- DropForeignKey
ALTER TABLE "prestataire" DROP CONSTRAINT "prestataire_utilisateur_id_fkey";

-- AlterTable
ALTER TABLE "contestation_charge" ALTER COLUMN "modifie_le" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_assigne_a_fkey" FOREIGN KEY ("assigne_a") REFERENCES "prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_log" ADD CONSTRAINT "incident_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
