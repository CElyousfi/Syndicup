-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "acteur_id" UUID,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entite_id" UUID NOT NULL,
    "avant_json" JSONB,
    "apres_json" JSONB,
    "horodatage" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_copropriete_id_idx" ON "audit_log"("copropriete_id");

-- CreateIndex
CREATE INDEX "audit_log_entite_entite_id_idx" ON "audit_log"("entite", "entite_id");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_acteur_id_fkey" FOREIGN KEY ("acteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS + append-only (CLAUDE.md §1 non-négociable n°2 / §2 : jamais UPDATE/DELETE sur une table
-- append-only, même par l'agent). GRANT limité à SELECT, INSERT — pas UPDATE/DELETE — pour
-- application_role : le blocage est donc appliqué au niveau du rôle Postgres, pas seulement à
-- la discrétion du code applicatif (Master Spec Partie 2.1).
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT ON "audit_log" TO application_role;

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;

-- Consultation réservée au syndic/conseil syndical de la copropriété (donnée sensible :
-- avant/après d'actions à valeur probante) ; l'acteur voit aussi ses propres actions.
CREATE POLICY tenant_isolation ON "audit_log"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR (
      copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
      AND (
        current_setting('app.current_role', true) IN ('SYNDIC', 'CONSEIL_SYNDICAL')
        OR acteur_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );
