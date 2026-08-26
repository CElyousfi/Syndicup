-- ════════════════════════════════════════════════════════════════════════════
-- M12 — IDEMPOTENCE GÉNÉRIQUE (Master Spec Partie 3.1, principe non négociable 1.7.3)
--
-- Le contrat OpenAPI déclare le header Idempotency-Key obligatoire sur toute écriture
-- financière ou à valeur probante ; cette table matérialise la clé côté serveur :
--   - rejeu même clé + même payload → réponse stockée renvoyée à l'identique ;
--   - même clé + payload différent → 409 CONFLICT (règle du contrat) ;
--   - clé en cours de traitement → 409 (requête concurrente).
-- UPDATE nécessaire (stockage de la réponse après exécution) — table non append-only :
-- ce n'est pas une table à valeur probante, c'est un mécanisme technique de transport.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE "idempotency_key" (
    "cle" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "copropriete_id" UUID NOT NULL,
    "utilisateur_id" UUID,
    "payload_hash" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "reponse_status" INTEGER,
    "reponse_json" JSONB,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_key_pkey" PRIMARY KEY ("cle", "endpoint")
);
CREATE INDEX "idempotency_key_copropriete_id_idx" ON "idempotency_key"("copropriete_id");
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_copropriete_id_fkey"
  FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_statut_check"
  CHECK ("statut" IN ('EN_COURS', 'TERMINE'));

GRANT SELECT, INSERT, UPDATE ON "idempotency_key" TO application_role;

ALTER TABLE "idempotency_key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_key" FORCE ROW LEVEL SECURITY;

-- Une clé d'idempotence n'est consultable/rejouable que par le tenant qui l'a posée.
CREATE POLICY tenant_isolation ON "idempotency_key"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );
