-- M29 — Abonnements SyndicUp (facturation de la plateforme, hors paiement in-app).
--
-- Les clients ne paient pas dans l'application : l'opérateur (SUPER_ADMIN) ouvre l'abonnement,
-- émet les factures, enregistre les paiements reçus (virement, chèque…) et pilote l'accès.
--   client_facturation      → qui paie (syndicat d'une résidence ou cabinet multi-résidences)
--   abonnement              → formule, prix, lots contractés, essai, période payée, délai de grâce
--   abonnement_copropriete  → résidences couvertes (une seule active par résidence)
--   facture_abonnement      → factures numérotées sans trou (SU-AAAA-NNNN)
--   paiement_abonnement     → APPEND-ONLY : encaissements (CLAUDE.md §1.2)
--   abonnement_evenement    → APPEND-ONLY : journal de l'abonnement (création, rappels, suspension…)
--
-- L'état d'accès (à jour / rappel / grâce / bloqué) est CALCULÉ à partir des dates
-- (apps/api/lib/abonnements/etat.ts) : il ne dépend jamais du passage d'un job.
-- Visibilité : SUPER_ADMIN uniquement, sauf la lecture de l'abonnement de la copropriété
-- courante (nécessaire au contrôle d'accès et à la fenêtre de rappel du syndic).

CREATE TYPE "TypeClientFacturation" AS ENUM ('SYNDICAT', 'CABINET');
CREATE TYPE "FormuleAbonnement" AS ENUM ('ESSENTIEL', 'STANDARD', 'PRESTIGE', 'CABINET');
CREATE TYPE "PeriodiciteAbonnement" AS ENUM ('ANNUELLE', 'MENSUELLE');
CREATE TYPE "StatutAbonnement" AS ENUM ('ESSAI', 'ACTIF', 'SUSPENDU', 'RESILIE');
CREATE TYPE "BasePrixAbonnement" AS ENUM ('TTC', 'HT');
CREATE TYPE "StatutFactureAbonnement" AS ENUM ('EMISE', 'PAYEE', 'ANNULEE');
CREATE TYPE "ModePaiementAbonnement" AS ENUM ('VIREMENT', 'CHEQUE', 'ESPECES', 'CARTE', 'AUTRE');
CREATE TYPE "TypeEvenementAbonnement" AS ENUM (
  'CREE', 'MODIFIE', 'ESSAI_PROLONGE', 'DELAI_ACCORDE', 'FACTURE_EMISE', 'FACTURE_ANNULEE',
  'PAIEMENT_ENREGISTRE', 'ACTIVE', 'SUSPENDU', 'REACTIVE', 'RESILIE',
  'COPROPRIETE_RATTACHEE', 'COPROPRIETE_RETIREE', 'RAPPEL_ENVOYE', 'LOTS_DEPASSES'
);

CREATE TABLE "client_facturation" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type"               "TypeClientFacturation" NOT NULL,
  "nom"                text NOT NULL,
  "raison_sociale"     text,
  "ice"                text,
  "rc"                 text,
  "identifiant_fiscal" text,
  "adresse"            text,
  "ville"              text,
  "contact_nom"        text,
  "contact_email"      text,
  "contact_telephone"  text,
  "cabinet_id"         uuid REFERENCES "cabinet"("id"),
  "notes"              text,
  "cree_le"            timestamptz NOT NULL DEFAULT now(),
  "modifie_le"         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "client_facturation_cabinet_id_idx" ON "client_facturation"("cabinet_id");

CREATE TABLE "abonnement" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id"               uuid NOT NULL REFERENCES "client_facturation"("id"),
  "formule"                 "FormuleAbonnement" NOT NULL,
  "periodicite"             "PeriodiciteAbonnement" NOT NULL DEFAULT 'ANNUELLE',
  "statut"                  "StatutAbonnement" NOT NULL DEFAULT 'ESSAI',
  "base_prix"               "BasePrixAbonnement" NOT NULL,
  "prix_lot"                numeric(10,2) NOT NULL CHECK ("prix_lot" >= 0),
  "taux_tva"                numeric(5,2) NOT NULL DEFAULT 20 CHECK ("taux_tva" >= 0),
  "minimum_mensuel"         numeric(14,2) CHECK ("minimum_mensuel" >= 0),
  "lots_contractes"         integer NOT NULL CHECK ("lots_contractes" > 0),
  "tarif_fondateur"         boolean NOT NULL DEFAULT false,
  "prix_garanti_jusqu_au"   date,
  "forfait_accompagne"      numeric(14,2) CHECK ("forfait_accompagne" >= 0),
  "date_debut"              date NOT NULL,
  "fin_essai"               date,
  "fin_periode"             date,
  "delai_grace_jours"       integer NOT NULL DEFAULT 15 CHECK ("delai_grace_jours" BETWEEN 0 AND 90),
  "acces_prolonge_jusqu_au" date,
  "motif_prolongation"      text,
  "suspendu_le"             timestamptz,
  "motif_suspension"        text,
  "resilie_le"              timestamptz,
  "motif_resiliation"       text,
  "notes"                   text,
  "cree_le"                 timestamptz NOT NULL DEFAULT now(),
  "modifie_le"              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "abonnement_essai_date" CHECK ("statut" <> 'ESSAI' OR "fin_essai" IS NOT NULL)
);
CREATE INDEX "abonnement_client_id_idx" ON "abonnement"("client_id");
CREATE INDEX "abonnement_statut_idx" ON "abonnement"("statut");

CREATE TABLE "abonnement_copropriete" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "abonnement_id"  uuid NOT NULL REFERENCES "abonnement"("id"),
  "copropriete_id" uuid NOT NULL REFERENCES "copropriete"("id"),
  "actif"          boolean NOT NULL DEFAULT true,
  "rattache_le"    timestamptz NOT NULL DEFAULT now(),
  "retire_le"      timestamptz
);
CREATE INDEX "abonnement_copropriete_abonnement_id_idx" ON "abonnement_copropriete"("abonnement_id");
-- Une résidence n'est couverte que par UN abonnement actif à la fois.
CREATE UNIQUE INDEX "abonnement_copropriete_unique_actif" ON "abonnement_copropriete"("copropriete_id") WHERE "actif" = true;

-- Numérotation des factures sans trou, par année (verrou de ligne pendant la transaction).
CREATE TABLE "compteur_facture_abonnement" (
  "annee"   integer PRIMARY KEY,
  "dernier" integer NOT NULL DEFAULT 0
);

CREATE TABLE "facture_abonnement" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "numero"           text NOT NULL UNIQUE,
  "abonnement_id"    uuid NOT NULL REFERENCES "abonnement"("id"),
  "client_id"        uuid NOT NULL REFERENCES "client_facturation"("id"),
  "periode_debut"    date NOT NULL,
  "periode_fin"      date NOT NULL,
  "lots"             integer NOT NULL,
  "lignes_json"      jsonb NOT NULL,
  "montant_ht"       numeric(14,2) NOT NULL,
  "montant_tva"      numeric(14,2) NOT NULL,
  "montant_ttc"      numeric(14,2) NOT NULL,
  "statut"           "StatutFactureAbonnement" NOT NULL DEFAULT 'EMISE',
  "emise_le"         date NOT NULL,
  "echeance"         date NOT NULL,
  "payee_le"         date,
  "annulee_le"       timestamptz,
  "motif_annulation" text,
  "cree_par"         uuid,
  "cree_le"          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "facture_abonnement_periode" CHECK ("periode_fin" > "periode_debut"),
  CONSTRAINT "facture_abonnement_total" CHECK ("montant_ttc" = "montant_ht" + "montant_tva")
);
CREATE INDEX "facture_abonnement_abonnement_id_idx" ON "facture_abonnement"("abonnement_id");
CREATE INDEX "facture_abonnement_statut_idx" ON "facture_abonnement"("statut", "echeance");

-- APPEND-ONLY : pas de modifie_le, pas d'UPDATE/DELETE accordé au rôle applicatif.
CREATE TABLE "paiement_abonnement" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "facture_id"  uuid NOT NULL REFERENCES "facture_abonnement"("id"),
  "montant"     numeric(14,2) NOT NULL CHECK ("montant" > 0),
  "mode"        "ModePaiementAbonnement" NOT NULL,
  "reference"   text,
  "recu_le"     date NOT NULL,
  "saisi_par"   uuid NOT NULL,
  "cree_le"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "paiement_abonnement_facture_id_idx" ON "paiement_abonnement"("facture_id");

-- APPEND-ONLY : journal de l'abonnement. `cle` rend les envois de rappel idempotents (un rappel
-- donné n'est journalisé — donc envoyé — qu'une fois).
CREATE TABLE "abonnement_evenement" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "abonnement_id" uuid NOT NULL REFERENCES "abonnement"("id"),
  "type"          "TypeEvenementAbonnement" NOT NULL,
  "details_json"  jsonb,
  "acteur_id"     uuid,
  "cle"           text UNIQUE,
  "horodatage"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "abonnement_evenement_abonnement_idx" ON "abonnement_evenement"("abonnement_id", "horodatage");
CREATE INDEX "abonnement_evenement_horodatage_idx" ON "abonnement_evenement"("horodatage");

GRANT SELECT, INSERT, UPDATE ON "client_facturation", "abonnement", "abonnement_copropriete", "facture_abonnement", "compteur_facture_abonnement" TO application_role;
GRANT SELECT, INSERT ON "paiement_abonnement", "abonnement_evenement" TO application_role;

ALTER TABLE "client_facturation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_facturation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "abonnement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "abonnement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "abonnement_copropriete" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "abonnement_copropriete" FORCE ROW LEVEL SECURITY;
ALTER TABLE "compteur_facture_abonnement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compteur_facture_abonnement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "facture_abonnement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "facture_abonnement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "paiement_abonnement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paiement_abonnement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "abonnement_evenement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "abonnement_evenement" FORCE ROW LEVEL SECURITY;

-- Opérateur plateforme : tout.
CREATE POLICY operateur ON "client_facturation" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');
CREATE POLICY operateur ON "abonnement" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');
CREATE POLICY operateur ON "abonnement_copropriete" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');
CREATE POLICY operateur ON "compteur_facture_abonnement" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');
CREATE POLICY operateur ON "facture_abonnement" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');
CREATE POLICY operateur ON "paiement_abonnement" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');
CREATE POLICY operateur ON "abonnement_evenement" USING (current_setting('app.current_role', true) = 'SUPER_ADMIN') WITH CHECK (current_setting('app.current_role', true) = 'SUPER_ADMIN');

-- Membres de la copropriété courante : LECTURE de son rattachement et de son abonnement
-- (contrôle d'accès + fenêtre de rappel). Rien d'autre (ni factures, ni client, ni journal).
CREATE POLICY lecture_copropriete_courante ON "abonnement_copropriete" FOR SELECT
  USING (copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid);
CREATE POLICY lecture_copropriete_courante ON "abonnement" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "abonnement_copropriete" ac
    WHERE ac.abonnement_id = "abonnement".id
      AND ac.actif = true
      AND ac.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  ));

-- Fonctions/objets : rien pour PostgREST (même règle que m27, les nouvelles tables héritent des
-- privilèges par défaut révoqués ; répété ici si la migration tourne hors Supabase).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "client_facturation", "abonnement", "abonnement_copropriete", "compteur_facture_abonnement", "facture_abonnement", "paiement_abonnement", "abonnement_evenement" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "client_facturation", "abonnement", "abonnement_copropriete", "compteur_facture_abonnement", "facture_abonnement", "paiement_abonnement", "abonnement_evenement" FROM authenticated;
  END IF;
END $$;
