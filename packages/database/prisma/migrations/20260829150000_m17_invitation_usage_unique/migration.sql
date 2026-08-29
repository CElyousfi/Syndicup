-- M17 — Invitation à usage strictement unique : le code se « consomme » au premier scan.
-- Le premier appareil qui ouvre le code (aperçu) y lie un jeton d'ouverture (haché) ; toute
-- autre ouverture sans ce jeton est refusée (OUVERTE), et l'acceptation exige le même jeton.
-- Le syndic voit l'ouverture (ouverte_le) et peut régénérer si l'invité a perdu son appareil.
ALTER TABLE "invitation"
  ADD COLUMN IF NOT EXISTS "ouverte_le" timestamptz,
  ADD COLUMN IF NOT EXISTS "jeton_ouverture_hash" text;

DROP FUNCTION IF EXISTS public.invitation_apercu(text);
CREATE OR REPLACE FUNCTION public.invitation_apercu(p_code text, p_jeton_hash text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv record;
  v_statut text;
  v_ouverte boolean := false;
BEGIN
  SELECT i.id, i.role_cible, i.expire_le, i.statut, i.ouverte_le, i.jeton_ouverture_hash, c.nom, c.ville
    INTO v_inv
    FROM "invitation" i JOIN "copropriete" c ON c.id = i.copropriete_id
   WHERE i.code = p_code
     FOR UPDATE OF i;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('statut', 'INVALIDE');
  END IF;
  v_statut := v_inv.statut::text;
  IF v_statut = 'EN_ATTENTE' AND v_inv.expire_le < now() THEN
    v_statut := 'EXPIREE';
  END IF;
  IF v_statut = 'EN_ATTENTE' THEN
    IF v_inv.ouverte_le IS NULL THEN
      -- Premier scan : le code se lie à cet appareil (jeton haché) — usage unique garanti.
      IF p_jeton_hash IS NOT NULL THEN
        UPDATE "invitation" SET ouverte_le = now(), jeton_ouverture_hash = p_jeton_hash WHERE id = v_inv.id;
      END IF;
    ELSIF p_jeton_hash IS NULL OR p_jeton_hash <> v_inv.jeton_ouverture_hash THEN
      v_statut := 'OUVERTE';
    ELSE
      v_ouverte := true;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'statut', v_statut,
    'copropriete_nom', v_inv.nom,
    'ville', v_inv.ville,
    'role_cible', v_inv.role_cible::text,
    'expire_le', to_char(v_inv.expire_le AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'ouverte', v_ouverte
  );
END;
$$;
REVOKE ALL ON FUNCTION public.invitation_apercu(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_apercu(text, text) TO application_role;

-- invitation_accepter : même signature + jeton ; un jeton absent/différent de celui du premier
-- scan = DEJA_UTILISEE (le code est déjà entre les mains d'un autre appareil).
DROP FUNCTION IF EXISTS public.invitation_accepter(text, uuid, text, text, boolean);
CREATE OR REPLACE FUNCTION public.invitation_accepter(
  p_code text,
  p_utilisateur_id uuid,
  p_email text,
  p_telephone text,
  p_identite_verifiee boolean,
  p_jeton_hash text DEFAULT NULL
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

  -- Usage unique : le code appartient à l'appareil qui l'a ouvert en premier.
  IF v_inv.jeton_ouverture_hash IS NOT NULL
     AND (p_jeton_hash IS NULL OR p_jeton_hash <> v_inv.jeton_ouverture_hash) THEN
    RETURN jsonb_build_object('statut', 'DEJA_UTILISEE');
  END IF;

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
    RETURN jsonb_build_object('statut', 'CONFLIT_SYNDIC');
  END;

  UPDATE "invitation" SET statut = 'ACCEPTEE' WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'statut', 'OK',
    'copropriete_id', v_inv.copropriete_id,
    'lot_id', v_inv.lot_id,
    'role', v_inv.role_cible::text,
    'statut_compte', v_statut_compte::text
  );
END;
$$;
REVOKE ALL ON FUNCTION public.invitation_accepter(text, uuid, text, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_accepter(text, uuid, text, text, boolean, text) TO application_role;
