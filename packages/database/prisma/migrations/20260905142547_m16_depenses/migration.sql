-- ════════════════════════════════════════════════════════════════════════════
-- M16 — DÉPENSES, FACTURES, FOURNISSEURS, POSTES BUDGÉTAIRES (Doc A §3, §6, §8)
-- « L'argent qui sort » : une dépense a un cycle de vie (BROUILLON → A_APPROUVER → APPROUVEE →
-- PAYEE), un paiement tracé (méthode, référence, preuve = Document JUSTIFICATIF_DEPENSE), des
-- factures (Document FACTURE) et un journal append-only. Payer depuis le fonds de réserve écrit
-- un mouvement DEPENSE dans fonds_reserve_mouvement (SEUL grand livre de la réserve) dans la
-- même transaction ; le solde ne peut jamais devenir négatif (trigger).
-- ⚠️ Ajouts signalés au-delà du Master Spec (CLAUDE.md §2) : 5 enums, 4 tables,
-- copropriete.seuil_approbation_conseil / reserve_sans_resolution_autorisee / tva_par_defaut,
-- prestataire.ice/rc/adresse/email/telephone/rib/notes/note_moyenne,
-- incident.note_prestataire/commentaire_prestataire/evalue_le, fonds_reserve_mouvement.depense_id.
-- Les DropForeignKey/AddForeignKey sur appareil_push / lot_location_courte_duree /
-- sejour_evenement ci-dessous réalignent la base sur les actions référentielles déclarées dans
-- schema.prisma (dérive héritée de M15/M19, détectée par `prisma migrate dev`) — aucune policy RLS
-- existante n'est modifiée.
-- ════════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "CategorieDepense" AS ENUM ('ENTRETIEN_COURANT', 'REPARATIONS', 'TRAVAUX', 'PERSONNEL', 'ENERGIE_EAU', 'ASSURANCE', 'HONORAIRES_SYNDIC', 'ADMINISTRATIF', 'IMPOTS_TAXES', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDepense" AS ENUM ('BROUILLON', 'A_APPROUVER', 'APPROUVEE', 'REJETEE', 'PAYEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "SourceFinancement" AS ENUM ('COMPTE_COURANT', 'FONDS_RESERVE');

-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('RECUE', 'VERIFIEE', 'CONTESTEE', 'REGLEE');

-- CreateEnum
CREATE TYPE "TypeDepenseLog" AS ENUM ('CREEE', 'SOUMISE', 'APPROUVEE', 'REJETEE', 'PAYEE', 'ANNULEE', 'FACTURE_AJOUTEE', 'FACTURE_CONTESTEE', 'MODIFIEE');

-- DropForeignKey
ALTER TABLE "appareil_push" DROP CONSTRAINT "appareil_push_utilisateur_id_fkey";

-- DropForeignKey
ALTER TABLE "lot_location_courte_duree" DROP CONSTRAINT "lot_location_courte_duree_decide_par_id_fkey";

-- DropForeignKey
ALTER TABLE "lot_location_courte_duree" DROP CONSTRAINT "lot_location_courte_duree_gestionnaire_id_fkey";

-- DropForeignKey
ALTER TABLE "sejour_evenement" DROP CONSTRAINT "sejour_evenement_acteur_id_fkey";

-- AlterTable
ALTER TABLE "copropriete" ADD COLUMN     "reserve_sans_resolution_autorisee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seuil_approbation_conseil" DECIMAL(14,2),
ADD COLUMN     "tva_par_defaut" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "fonds_reserve_mouvement" ADD COLUMN     "depense_id" UUID;

-- AlterTable
ALTER TABLE "incident" ADD COLUMN     "commentaire_prestataire" TEXT,
ADD COLUMN     "evalue_le" TIMESTAMPTZ,
ADD COLUMN     "note_prestataire" INTEGER;

-- AlterTable
ALTER TABLE "prestataire" ADD COLUMN     "adresse" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "ice" TEXT,
ADD COLUMN     "note_moyenne" DECIMAL(3,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rc" TEXT,
ADD COLUMN     "rib" TEXT,
ADD COLUMN     "telephone" TEXT;

-- CreateTable
CREATE TABLE "budget_poste" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "budget_ag_id" UUID NOT NULL,
    "categorie" "CategorieDepense" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant_prevu" DECIMAL(14,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "budget_poste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "budget_ag_id" UUID,
    "budget_poste_id" UUID,
    "prestataire_id" UUID,
    "categorie" "CategorieDepense" NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "montant_ht" DECIMAL(14,2),
    "tva" DECIMAL(14,2),
    "montant_ttc" DECIMAL(14,2) NOT NULL,
    "date_depense" DATE NOT NULL,
    "statut" "StatutDepense" NOT NULL DEFAULT 'BROUILLON',
    "source" "SourceFinancement" NOT NULL DEFAULT 'COMPTE_COURANT',
    "incident_id" UUID,
    "contrat_id" UUID,
    "personnel_id" UUID,
    "periode_paie" TEXT,
    "cree_par_id" UUID NOT NULL,
    "approuve_par_id" UUID,
    "approuve_le" TIMESTAMPTZ,
    "motif_rejet" TEXT,
    "paye_le" DATE,
    "methode_paiement" "MethodePaiement",
    "reference_paiement" TEXT,
    "justificatif_paiement_document_id" UUID,
    "resolution_ag_id" UUID,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facture" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "depense_id" UUID NOT NULL,
    "prestataire_id" UUID,
    "numero" TEXT,
    "date_facture" DATE NOT NULL,
    "date_echeance" DATE,
    "montant_ttc" DECIMAL(14,2) NOT NULL,
    "statut" "StatutFacture" NOT NULL DEFAULT 'RECUE',
    "document_id" UUID NOT NULL,
    "rappel_echeance_envoye_le" TIMESTAMPTZ,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depense_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "depense_id" UUID NOT NULL,
    "type" "TypeDepenseLog" NOT NULL,
    "acteur_id" UUID,
    "details_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depense_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_poste_budget_ag_id_idx" ON "budget_poste"("budget_ag_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_poste_budget_ag_id_categorie_libelle_key" ON "budget_poste"("budget_ag_id", "categorie", "libelle");

-- CreateIndex
CREATE INDEX "depense_copropriete_id_statut_idx" ON "depense"("copropriete_id", "statut");

-- CreateIndex
CREATE INDEX "depense_copropriete_id_date_depense_idx" ON "depense"("copropriete_id", "date_depense");

-- CreateIndex
CREATE INDEX "depense_budget_poste_id_idx" ON "depense"("budget_poste_id");

-- CreateIndex
CREATE INDEX "depense_prestataire_id_idx" ON "depense"("prestataire_id");

-- CreateIndex
CREATE INDEX "depense_incident_id_idx" ON "depense"("incident_id");

-- CreateIndex
CREATE INDEX "facture_depense_id_idx" ON "facture"("depense_id");

-- CreateIndex
CREATE INDEX "facture_date_echeance_idx" ON "facture"("date_echeance");

-- CreateIndex
CREATE INDEX "depense_log_depense_id_idx" ON "depense_log"("depense_id");

-- CreateIndex
CREATE INDEX "depense_log_copropriete_id_idx" ON "depense_log"("copropriete_id");

-- CreateIndex
CREATE INDEX "fonds_reserve_mouvement_depense_id_idx" ON "fonds_reserve_mouvement"("depense_id");

-- AddForeignKey
ALTER TABLE "appareil_push" ADD CONSTRAINT "appareil_push_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fonds_reserve_mouvement" ADD CONSTRAINT "fonds_reserve_mouvement_depense_id_fkey" FOREIGN KEY ("depense_id") REFERENCES "depense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_gestionnaire_id_fkey" FOREIGN KEY ("gestionnaire_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_location_courte_duree" ADD CONSTRAINT "lot_location_courte_duree_decide_par_id_fkey" FOREIGN KEY ("decide_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sejour_evenement" ADD CONSTRAINT "sejour_evenement_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_poste" ADD CONSTRAINT "budget_poste_budget_ag_id_fkey" FOREIGN KEY ("budget_ag_id") REFERENCES "budget_ag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_budget_ag_id_fkey" FOREIGN KEY ("budget_ag_id") REFERENCES "budget_ag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_budget_poste_id_fkey" FOREIGN KEY ("budget_poste_id") REFERENCES "budget_poste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_prestataire_id_fkey" FOREIGN KEY ("prestataire_id") REFERENCES "prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_approuve_par_id_fkey" FOREIGN KEY ("approuve_par_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_justificatif_paiement_document_id_fkey" FOREIGN KEY ("justificatif_paiement_document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense" ADD CONSTRAINT "depense_resolution_ag_id_fkey" FOREIGN KEY ("resolution_ag_id") REFERENCES "ag_resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_depense_id_fkey" FOREIGN KEY ("depense_id") REFERENCES "depense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_prestataire_id_fkey" FOREIGN KEY ("prestataire_id") REFERENCES "prestataire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense_log" ADD CONSTRAINT "depense_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense_log" ADD CONSTRAINT "depense_log_depense_id_fkey" FOREIGN KEY ("depense_id") REFERENCES "depense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depense_log" ADD CONSTRAINT "depense_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ════════════════════════════════════════════════════════════════════════════
-- M16 — compléments SQL : contraintes, reprise de données, triggers, RLS
-- ════════════════════════════════════════════════════════════════════════════

-- Contraintes métier (CLAUDE.md §1.5 : jamais de défaut silencieux sur un champ sensible)
ALTER TABLE "depense" ADD CONSTRAINT "depense_montant_ttc_check" CHECK ("montant_ttc" > 0);
ALTER TABLE "depense" ADD CONSTRAINT "depense_montants_ht_tva_check" CHECK (("montant_ht" IS NULL AND "tva" IS NULL) OR ("montant_ht" >= 0 AND "tva" >= 0));
ALTER TABLE "depense" ADD CONSTRAINT "depense_periode_paie_check" CHECK ("periode_paie" IS NULL OR "periode_paie" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "budget_poste" ADD CONSTRAINT "budget_poste_montant_prevu_check" CHECK ("montant_prevu" >= 0);
ALTER TABLE "facture" ADD CONSTRAINT "facture_montant_ttc_check" CHECK ("montant_ttc" > 0);
ALTER TABLE "facture" ADD CONSTRAINT "facture_dates_check" CHECK ("date_echeance" IS NULL OR "date_echeance" >= "date_facture");
ALTER TABLE "incident" ADD CONSTRAINT "incident_note_prestataire_check" CHECK ("note_prestataire" IS NULL OR ("note_prestataire" BETWEEN 1 AND 5));
ALTER TABLE "copropriete" ADD CONSTRAINT "copropriete_seuil_approbation_conseil_check" CHECK ("seuil_approbation_conseil" IS NULL OR "seuil_approbation_conseil" >= 0);
ALTER TABLE "copropriete" ADD CONSTRAINT "copropriete_tva_par_defaut_check" CHECK ("tva_par_defaut" IS NULL OR ("tva_par_defaut" >= 0 AND "tva_par_defaut" <= 100));
-- Grand livre de la réserve (Master Spec 6.5) : une cotisation est positive, une dépense négative.
ALTER TABLE "fonds_reserve_mouvement" ADD CONSTRAINT "fonds_reserve_mouvement_signe_check"
  CHECK (("type" = 'COTISATION' AND "montant" > 0) OR ("type" = 'DEPENSE' AND "montant" < 0));

-- Reprise : prestataire.contact → telephone / email quand la valeur est reconnaissable
-- (`contact` conservé tel quel pour compatibilité).
UPDATE "prestataire" SET "telephone" = "contact"
  WHERE "telephone" IS NULL AND "contact" ~ '^\+?[0-9][0-9 .-]{7,19}$';
UPDATE "prestataire" SET "email" = lower("contact")
  WHERE "email" IS NULL AND "contact" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

-- Reprise : chaque budget existant reçoit UNE ligne AUTRE / « Budget global » = montant total,
-- pour qu'aucun budget ne soit orphelin de l'invariant montant_total = Σ postes.
INSERT INTO "budget_poste" ("id", "budget_ag_id", "categorie", "libelle", "montant_prevu", "ordre", "modifie_le")
SELECT gen_random_uuid(), b."id", 'AUTRE', 'Budget global', b."montant_total", 0, now()
  FROM "budget_ag" b
 WHERE NOT EXISTS (SELECT 1 FROM "budget_poste" p WHERE p."budget_ag_id" = b."id");

-- Invariant : budget_ag.montant_total = Σ budget_poste.montant_prevu (jamais édité directement
-- quand des lignes existent — le service renvoie 422 BUDGET_TOTAL_DERIVE_DES_POSTES).
CREATE OR REPLACE FUNCTION public.budget_ag_recalculer_total()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_budget uuid;
BEGIN
  v_budget := COALESCE(NEW."budget_ag_id", OLD."budget_ag_id");
  UPDATE "budget_ag"
     SET "montant_total" = COALESCE((SELECT SUM("montant_prevu") FROM "budget_poste" WHERE "budget_ag_id" = v_budget), 0),
         "modifie_le" = now()
   WHERE "id" = v_budget;
  IF TG_OP = 'UPDATE' AND NEW."budget_ag_id" <> OLD."budget_ag_id" THEN
    UPDATE "budget_ag"
       SET "montant_total" = COALESCE((SELECT SUM("montant_prevu") FROM "budget_poste" WHERE "budget_ag_id" = OLD."budget_ag_id"), 0),
           "modifie_le" = now()
     WHERE "id" = OLD."budget_ag_id";
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER "budget_poste_recalculer_total"
  AFTER INSERT OR UPDATE OR DELETE ON "budget_poste"
  FOR EACH ROW EXECUTE FUNCTION public.budget_ag_recalculer_total();

-- Le solde du fonds de réserve ne peut jamais devenir négatif (Doc A §3.6) — filet DB en plus du
-- 422 FONDS_RESERVE_INSUFFISANT du service (deux paiements concurrents ne peuvent pas passer).
CREATE OR REPLACE FUNCTION public.fonds_reserve_solde_non_negatif()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_solde numeric(14,2);
BEGIN
  SELECT COALESCE(SUM("montant"), 0) INTO v_solde
    FROM "fonds_reserve_mouvement" WHERE "fonds_reserve_id" = NEW."fonds_reserve_id";
  IF v_solde < 0 THEN
    RAISE EXCEPTION 'FONDS_RESERVE_INSUFFISANT' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER "fonds_reserve_mouvement_solde_non_negatif"
  AFTER INSERT ON "fonds_reserve_mouvement"
  FOR EACH ROW EXECUTE FUNCTION public.fonds_reserve_solde_non_negatif();

-- Fonctions SECURITY DEFINER (même pattern que M5/M7/M15) — lookups d'identifiants pour les policies.
CREATE OR REPLACE FUNCTION public.budget_ag_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "budget_ag" WHERE id = p_id;
$$;
CREATE OR REPLACE FUNCTION public.depense_copropriete_id(p_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "depense" WHERE id = p_id;
$$;
CREATE OR REPLACE FUNCTION public.depense_statut(p_id uuid)
RETURNS "StatutDepense"
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT statut FROM "depense" WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION public.budget_ag_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.depense_copropriete_id FROM PUBLIC;
REVOKE ALL ON FUNCTION public.depense_statut FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.budget_ag_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.depense_copropriete_id TO application_role;
GRANT EXECUTE ON FUNCTION public.depense_statut TO application_role;

-- GRANTs : tables mutables vs journal append-only (CLAUDE.md §1 n°2 : ni UPDATE ni DELETE).
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget_poste", "depense", "facture" TO application_role;
GRANT SELECT, INSERT ON "depense_log" TO application_role;

ALTER TABLE "budget_poste" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget_poste" FORCE ROW LEVEL SECURITY;
ALTER TABLE "depense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "depense" FORCE ROW LEVEL SECURITY;
ALTER TABLE "facture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "facture" FORCE ROW LEVEL SECURITY;
ALTER TABLE "depense_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "depense_log" FORCE ROW LEVEL SECURITY;

-- budget_poste : même visibilité que budget_ag (transparence budgétaire, Doc A §10.2 « détail
-- budget par poste visible dans l'app ») — tout membre du tenant lit ; l'écriture est gatée par
-- la permission finances.gerer_budget au service (le WITH CHECK reprend le USING).
CREATE POLICY tenant_isolation ON "budget_poste"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR public.budget_ag_copropriete_id(budget_ag_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- depense : syndic / conseil syndical lisent et écrivent tout ; un résident (propriétaire,
-- indivisaire, locataire, représentant) ne lit que les dépenses PAYEE (transparence « où va mon
-- argent », exposée par M18) — jamais un brouillon ni une dépense en cours d'approbation.
-- Gardien et prestataire : rien.
CREATE POLICY tenant_isolation ON "depense"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR (
          current_setting('app.current_role', true) IN ('PROPRIETAIRE', 'INDIVISAIRE', 'LOCATAIRE', 'PERSONNE_MORALE_REPRESENTANT')
          AND statut = 'PAYEE'
        )
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

-- facture : syndic / conseil syndical uniquement (la visibilité résident des factures des dépenses
-- PAYEE est un paramètre M18 `factures_visibles_residents`, non ouvert ici).
CREATE POLICY tenant_isolation ON "facture"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      public.depense_copropriete_id(depense_id) = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );

-- depense_log : append-only (aucune policy UPDATE/DELETE, GRANT SELECT+INSERT seulement),
-- lecture/écriture syndic / conseil syndical (+ système).
CREATE POLICY tenant_isolation ON "depense_log"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );
CREATE POLICY tenant_insert ON "depense_log"
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND public.depense_copropriete_id(depense_id) = copropriete_id
      AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
    )
  );
