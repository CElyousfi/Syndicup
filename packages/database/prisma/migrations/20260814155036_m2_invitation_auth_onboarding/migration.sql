-- CreateEnum
CREATE TYPE "CanalInvitation" AS ENUM ('EMAIL', 'SMS', 'QR_CODE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "StatutInvitation" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'EXPIREE', 'REGENEREE');

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "copropriete_id" UUID NOT NULL,
    "lot_id" UUID,
    "role_cible" "RoleType" NOT NULL,
    "emetteur_id" UUID NOT NULL,
    "canal" "CanalInvitation" NOT NULL,
    "code" TEXT NOT NULL,
    "statut" "StatutInvitation" NOT NULL DEFAULT 'EN_ATTENTE',
    "expire_le" TIMESTAMPTZ NOT NULL,
    "cree_le" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitation_code_key" ON "invitation"("code");

-- CreateIndex
CREATE INDEX "invitation_copropriete_id_idx" ON "invitation"("copropriete_id");

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "copropriete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_emetteur_id_fkey" FOREIGN KEY ("emetteur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS invitation — même migration que la création de table (CLAUDE.md §1.8).
-- Le code d'invitation est un secret : la recherche par code SANS contexte tenant
-- (utilisateur pas encore rattaché) passe exclusivement par la fonction SECURITY DEFINER
-- invitation_accepter() ci-dessous — jamais par une policy ouverte.
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON "invitation" TO application_role;

ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitation" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "invitation"
  USING (
    current_setting('app.current_role', true) = 'SUPER_ADMIN'
    OR copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  );

-- ════════════════════════════════════════════════════════════════════════════
-- invitation_accepter — acceptation atomique d'une invitation (Master Spec Partie 5.3, 5.5).
-- SECURITY DEFINER (owner BYPASSRLS) parce que l'appelant n'a pas encore de contexte tenant.
-- Retourne un statut applicatif explicite — jamais de défaut silencieux (CLAUDE.md §1.5) :
--   OK | INVALIDE | DEJA_UTILISEE | EXPIREE | EMAIL_DEJA_UTILISE | TELEPHONE_DEJA_UTILISE | CONFLIT_SYNDIC
-- Edge cases couverts (Partie 5.5) :
--   - code déjà utilisé re-soumis → DEJA_UTILISEE ("déjà inscrit, connectez-vous")
--   - invitation expirée → EXPIREE (le syndic régénère via POST /invitations/:id/regenerer)
--   - email déjà utilisé par un AUTRE compte → EMAIL_DEJA_UTILISE (fusion forcée par le syndic
--     = hors scope M2, tracé dans le message d'erreur API)
--   - doublon de personne (même auth uid, 2e invitation) → un seul utilisateur_id, rôle ajouté
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.invitation_accepter(
  p_code text,
  p_utilisateur_id uuid,   -- = auth.users.id (Supabase) : convention utilisateur.id ≡ auth uid
  p_email text,
  p_telephone text,
  p_identite_verifiee boolean  -- OTP/email confirmé côté Supabase → ACTIF, sinon EN_VALIDATION
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv "invitation"%ROWTYPE;
  v_statut_compte "StatutCompteUtilisateur";
BEGIN
  SELECT * INTO v_inv FROM "invitation" WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('statut', 'INVALIDE');
  END IF;

  IF v_inv.statut = 'ACCEPTEE' THEN
    RETURN jsonb_build_object('statut', 'DEJA_UTILISEE');
  END IF;

  IF v_inv.statut IN ('EXPIREE', 'REGENEREE') OR v_inv.expire_le < now() THEN
    IF v_inv.statut = 'EN_ATTENTE' THEN
      UPDATE "invitation" SET statut = 'EXPIREE' WHERE id = v_inv.id;
    END IF;
    RETURN jsonb_build_object('statut', 'EXPIREE');
  END IF;

  -- Unicité email/téléphone : blocage explicite si utilisés par un AUTRE compte (Partie 5.5).
  IF p_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM "utilisateur" WHERE email = p_email AND id <> p_utilisateur_id
  ) THEN
    RETURN jsonb_build_object('statut', 'EMAIL_DEJA_UTILISE');
  END IF;
  IF p_telephone IS NOT NULL AND EXISTS (
    SELECT 1 FROM "utilisateur" WHERE telephone = p_telephone AND id <> p_utilisateur_id
  ) THEN
    RETURN jsonb_build_object('statut', 'TELEPHONE_DEJA_UTILISE');
  END IF;

  v_statut_compte := CASE WHEN p_identite_verifiee THEN 'ACTIF' ELSE 'EN_VALIDATION' END::"StatutCompteUtilisateur";

  -- Doublon de personne (2e invitation, même auth uid) : un seul utilisateur_id (Partie 5.5) —
  -- on ne rétrograde jamais un compte déjà ACTIF.
  INSERT INTO "utilisateur" (id, email, telephone, statut_compte, modifie_le)
  VALUES (p_utilisateur_id, p_email, p_telephone, v_statut_compte, now())
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE("utilisateur".email, EXCLUDED.email),
    telephone = COALESCE("utilisateur".telephone, EXCLUDED.telephone),
    statut_compte = CASE
      WHEN "utilisateur".statut_compte IN ('INVITE', 'EN_VALIDATION') THEN EXCLUDED.statut_compte
      ELSE "utilisateur".statut_compte
    END,
    modifie_le = now();

  BEGIN
    INSERT INTO "role_utilisateur" (utilisateur_id, copropriete_id, role)
    SELECT p_utilisateur_id, v_inv.copropriete_id, v_inv.role_cible
    WHERE NOT EXISTS (
      SELECT 1 FROM "role_utilisateur"
      WHERE utilisateur_id = p_utilisateur_id
        AND copropriete_id = v_inv.copropriete_id
        AND role = v_inv.role_cible
        AND actif = true
    );
  EXCEPTION WHEN unique_violation THEN
    -- Index partiel role_syndic_unique_actif : un seul SYNDIC actif par copropriété (Partie 2.4).
    RETURN jsonb_build_object('statut', 'CONFLIT_SYNDIC');
  END;

  UPDATE "invitation" SET statut = 'ACCEPTEE' WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'statut', 'OK',
    'copropriete_id', v_inv.copropriete_id,
    'lot_id', v_inv.lot_id,
    'role', v_inv.role_cible,
    'statut_compte', v_statut_compte
  );
END $$;

REVOKE ALL ON FUNCTION public.invitation_accepter FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_accepter TO application_role;

-- ════════════════════════════════════════════════════════════════════════════
-- custom_access_token_hook — Supabase Auth (Master Spec Partie 4.4) : injecte la claim
-- `roles: [{copropriete_id, role}]` depuis role_utilisateur à chaque émission de token.
-- Configuré dans supabase/config.toml ([auth.hook.custom_access_token]) et à activer sur le
-- dashboard en staging/production. SECURITY DEFINER : lit role_utilisateur malgré RLS.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_roles jsonb;
  claims jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('copropriete_id', ru.copropriete_id, 'role', ru.role)),
    '[]'::jsonb
  )
  INTO v_roles
  FROM "role_utilisateur" ru
  WHERE ru.utilisateur_id = (event->>'user_id')::uuid AND ru.actif = true;

  claims := COALESCE(event->'claims', '{}'::jsonb) || jsonb_build_object('roles', v_roles);
  RETURN jsonb_set(event, '{claims}', claims);
END $$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook FROM PUBLIC;

-- supabase_auth_admin n'existe que sur un Postgres Supabase (absent du Postgres nu de la CI).
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
  END IF;
END $$;
