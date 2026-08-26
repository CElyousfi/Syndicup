-- ════════════════════════════════════════════════════════════════════════════
-- M12 — SESSION DE PAIEMENT CMI (Master Spec Partie 6.4, étape 1)
--
-- Lève l'ÉCART SIGNALÉ de M5 : la cible du paiement (appel_de_fonds_lot_id) était encodée
-- dans l'`oid` transmis à CMI faute de table de session. Cette table matérialise la session :
-- le webhook résout désormais la cible via la session persistée (oid UNIQUE), plus par
-- décodage de l'oid. Le payload webhook reste À VALIDER contre un vrai bac à sable CMI
-- (credentials commerçant absents du repo).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE "paiement_cmi_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "appel_de_fonds_lot_id" UUID NOT NULL,
    "oid" TEXT NOT NULL,
    "montant" DECIMAL(14,2) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'INITIEE',
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmee_le" TIMESTAMPTZ,
    CONSTRAINT "paiement_cmi_session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "paiement_cmi_session_oid_key" ON "paiement_cmi_session"("oid");
CREATE INDEX "paiement_cmi_session_copropriete_id_idx" ON "paiement_cmi_session"("copropriete_id");
ALTER TABLE "paiement_cmi_session" ADD CONSTRAINT "paiement_cmi_session_copropriete_id_fkey"
  FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paiement_cmi_session" ADD CONSTRAINT "paiement_cmi_session_appel_de_fonds_lot_id_fkey"
  FOREIGN KEY ("appel_de_fonds_lot_id") REFERENCES "appel_de_fonds_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paiement_cmi_session" ADD CONSTRAINT "paiement_cmi_session_statut_check"
  CHECK ("statut" IN ('INITIEE', 'CONFIRMEE', 'ECHOUEE'));

-- UPDATE nécessaire (passage INITIEE → CONFIRMEE/ECHOUEE) — la preuve probante reste la
-- ligne `paiement` append-only, pas la session.
GRANT SELECT, INSERT, UPDATE ON "paiement_cmi_session" TO application_role;

ALTER TABLE "paiement_cmi_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paiement_cmi_session" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "paiement_cmi_session"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- Bootstrap RLS du webhook (même rôle que lot_copropriete_id, M3) : le webhook CMI arrive sans
-- contexte tenant — cette fonction SECURITY DEFINER résout le copropriete_id de la session pour
-- ouvrir la transaction withTenant système.
CREATE OR REPLACE FUNCTION public.cmi_session_copropriete_id(p_oid text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT copropriete_id FROM "paiement_cmi_session" WHERE oid = p_oid;
$$;
REVOKE ALL ON FUNCTION public.cmi_session_copropriete_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmi_session_copropriete_id(text) TO application_role;
