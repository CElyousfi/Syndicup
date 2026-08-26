-- ════════════════════════════════════════════════════════════════════════════
-- M9 — NOTIFICATIONS & DOCUMENTS (Master Spec Partie 7, 9 ; Doc A §12.2/12.3)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE "VisibiliteDocument" AS ENUM ('PUBLIC_COPROPRIETE', 'SYNDIC_ONLY', 'CONSEIL_SYNDICAL');
CREATE TYPE "CanalNotification" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP');
CREATE TYPE "StatutEnvoiNotification" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ECHOUE');

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "visibilite" "VisibiliteDocument" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "cree_par" UUID,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "document_copropriete_id_idx" ON "document"("copropriete_id");
ALTER TABLE "document" ADD CONSTRAINT "document_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document" ADD CONSTRAINT "document_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable : quasi append-only (Master Spec Partie 7.2 — preuve légale d'envoi). Seul
-- l'endpoint applicatif `marquerLue` (lib/notifications/notifications.ts) fait un UPDATE, limité
-- en pratique aux colonnes lu/lu_le — la policy RLS ci-dessous ne restreint pas les colonnes
-- modifiables (Postgres ne le permet pas nativement par policy), seulement la ligne ciblée.
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "template_code" TEXT NOT NULL,
    "canal" "CanalNotification" NOT NULL,
    "statut_envoi" "StatutEnvoiNotification" NOT NULL DEFAULT 'EN_ATTENTE',
    "contenu_json" JSONB,
    "accuse_reception" TIMESTAMPTZ,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "lu_le" TIMESTAMPTZ,
    "horodatage_envoi" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_copropriete_id_idx" ON "notification"("copropriete_id");
CREATE INDEX "notification_utilisateur_id_idx" ON "notification"("utilisateur_id");
ALTER TABLE "notification" ADD CONSTRAINT "notification_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification" ADD CONSTRAINT "notification_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "document" TO application_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON "notification" TO application_role;

ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;

-- Doc A §12.3 : matrice de visibilité appliquée en RLS, pas uniquement en filtre applicatif.
CREATE POLICY tenant_isolation ON "document"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        visibilite = 'PUBLIC_COPROPRIETE'
        OR (visibilite = 'SYNDIC_ONLY' AND current_setting('app.current_role', true) = 'SYNDIC')
        OR (visibilite = 'CONSEIL_SYNDICAL' AND current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL'))
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND current_setting('app.current_role', true) = 'SYNDIC'
    )
  );

-- Notification = boîte de réception personnelle (Master Spec Partie 7.2), pas d'exception
-- SYNDIC/CONSEIL_SYNDICAL contrairement aux autres tables — même un syndic ne lit pas les
-- notifications d'autrui.
CREATE POLICY tenant_isolation ON "notification"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND utilisateur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );
