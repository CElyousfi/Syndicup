-- CreateEnum
CREATE TYPE "StatutJustificatif" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE', 'ANNULE');

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "comptes_bancaires_json" JSONB,
ADD COLUMN     "delai_validation_justificatif_jours" INTEGER;

-- AlterTable
ALTER TABLE "paiement" ADD COLUMN     "date_valeur" DATE,
ADD COLUMN     "document_id" UUID,
ADD COLUMN     "enregistre_par_id" UUID,
ADD COLUMN     "justificatif_id" UUID;

-- CreateTable
CREATE TABLE "justificatif_paiement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "appel_de_fonds_lot_id" UUID,
    "declare_par_id" UUID NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "methode" "MethodePaiement" NOT NULL,
    "date_paiement_declaree" DATE NOT NULL,
    "banque_emettrice" TEXT,
    "beneficiaire" TEXT NOT NULL,
    "reference" TEXT,
    "document_id" UUID,
    "statut" "StatutJustificatif" NOT NULL DEFAULT 'EN_ATTENTE',
    "traite_par_id" UUID,
    "traite_le" TIMESTAMPTZ,
    "motif_rejet" TEXT,
    "paiement_id" UUID,
    "details_json" JSONB,
    "relance_envoyee_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "justificatif_paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "justificatif_paiement_copropriete_id_statut_idx" ON "justificatif_paiement"("copropriete_id", "statut");

-- CreateIndex
CREATE INDEX "justificatif_paiement_lot_id_idx" ON "justificatif_paiement"("lot_id");

-- CreateIndex
CREATE INDEX "justificatif_paiement_declare_par_id_idx" ON "justificatif_paiement"("declare_par_id");

-- CreateIndex
CREATE INDEX "paiement_justificatif_id_idx" ON "paiement"("justificatif_id");

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_justificatif_id_fkey" FOREIGN KEY ("justificatif_id") REFERENCES "justificatif_paiement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_enregistre_par_id_fkey" FOREIGN KEY ("enregistre_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiement" ADD CONSTRAINT "paiement_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_declare_par_id_fkey" FOREIGN KEY ("declare_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_traite_par_id_fkey" FOREIGN KEY ("traite_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- M17 — JUSTIFICATIFS DE PAIEMENT : contraintes, fonctions, RLS
-- Doc A §3.3/§3.4 : le résident déclare son paiement avec preuve, le syndic valide contre le
-- relevé (aucune API bancaire). Confidentialité §12.3 : un résident ne voit que les justificatifs
-- de SES lots ; le gardien ceux qu'il a saisis ; syndic / conseil tout. Aucune policy existante
-- n'est modifiée (paiement garde ses GRANTs append-only : SELECT, INSERT).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_montant_check" CHECK ("montant" > 0);
ALTER TABLE "justificatif_paiement" ADD CONSTRAINT "justificatif_paiement_methode_check" CHECK ("methode" IN ('VIREMENT', 'CHEQUE', 'ESPECES'));
ALTER TABLE "copropriete" ADD CONSTRAINT "copropriete_delai_validation_justificatif_check" CHECK ("delai_validation_justificatif_jours" IS NULL OR "delai_validation_justificatif_jours" >= 1);

-- Chemin storage de la preuve d'un justificatif — SECURITY DEFINER : le document est SYNDIC_ONLY
-- (aucune nouvelle visibilité inventée), le résident y accède via SON justificatif (déjà filtré
-- par la policy ci-dessous avant l'appel). Renvoie NULL si le justificatif n'a pas de preuve.
CREATE OR REPLACE FUNCTION public.justificatif_preuve_chemin(p_justificatif_id uuid)
RETURNS TABLE(storage_path text, nom text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT d.storage_path, d.nom FROM "justificatif_paiement" j JOIN "document" d ON d.id = j.document_id WHERE j.id = p_justificatif_id;
$$;
REVOKE ALL ON FUNCTION public.justificatif_preuve_chemin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.justificatif_preuve_chemin TO application_role;

GRANT SELECT, INSERT, UPDATE ON "justificatif_paiement" TO application_role;
ALTER TABLE "justificatif_paiement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "justificatif_paiement" FORCE ROW LEVEL SECURITY;

-- Lecture : syndic / conseil (tout) ; propriétaire / indivisaire / représentant / locataire
-- (lots dont ils sont propriétaire ou occupant — mêmes fonctions que appel_de_fonds_lot, M5) ;
-- gardien (ce qu'il a déclaré lui-même : espèces reçues à la loge). Prestataire : rien.
-- Écriture : mêmes acteurs sur le même périmètre (le service impose EN_ATTENTE à la création et
-- réserve valider / rejeter au syndic).
CREATE POLICY tenant_isolation ON "justificatif_paiement"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT', 'LOCATAIRE')
          AND (
            lot_id IN (SELECT lot_id FROM public.lots_proprietaire_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
            OR lot_id IN (SELECT lot_id FROM public.lots_occupant_de(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
          )
        )
        OR (
          current_setting('app.current_role', true) = 'GARDIEN'
          AND declare_par_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        )
      )
    )
  );
