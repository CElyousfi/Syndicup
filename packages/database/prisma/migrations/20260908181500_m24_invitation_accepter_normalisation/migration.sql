-- M24 — invitation_accepter : les quote-parts des co-indivisaires importés sont toujours normalisées à 100 %
-- (le premier accepté porte 100 % tant qu'il est seul, puis 50/50 quand le second accepte).
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
  v_elem jsonb;
  v_lot_id uuid;
  v_prevue numeric(7,2);
  v_total numeric(9,2);
  v_reste numeric(7,2);
  v_row record;
  v_new_lp uuid;
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

  -- M24 — identité et rattachements pré-remplis par l'import.
  IF v_inv.pre_rempli_json IS NOT NULL THEN
    UPDATE "utilisateur" SET
      nom = COALESCE(nom, NULLIF(v_inv.pre_rempli_json->>'nom', '')),
      prenom = COALESCE(prenom, NULLIF(v_inv.pre_rempli_json->>'prenom', '')),
      modifie_le = now()
    WHERE id = p_utilisateur_id;

    IF v_inv.role_cible IN ('PROPRIETAIRE', 'INDIVISAIRE', 'PERSONNE_MORALE_REPRESENTANT') THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_inv.pre_rempli_json->'lots', '[]'::jsonb)) LOOP
        v_lot_id := (v_elem->>'lot_id')::uuid;
        v_prevue := COALESCE(NULLIF(v_elem->>'quote_part', '')::numeric, 100);
        IF NOT EXISTS (SELECT 1 FROM "lot" WHERE id = v_lot_id AND copropriete_id = v_inv.copropriete_id) THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM "lot_proprietaire" WHERE lot_id = v_lot_id AND utilisateur_id = p_utilisateur_id AND date_fin IS NULL) THEN CONTINUE; END IF;
        INSERT INTO "lot_proprietaire" (lot_id, utilisateur_id, quote_part, type_propriete, est_representant_indivision, date_debut)
        VALUES (v_lot_id, p_utilisateur_id, v_prevue,
                COALESCE(NULLIF(v_elem->>'type_propriete', ''), CASE WHEN v_inv.role_cible = 'INDIVISAIRE' THEN 'INDIVISION' ELSE 'PLEIN' END)::"TypePropriete",
                COALESCE((v_elem->>'representant')::boolean, false),
                COALESCE(NULLIF(v_elem->>'date_debut', '')::date, CURRENT_DATE))
        RETURNING id INTO v_new_lp;
        -- Rééquilibrage : parts prévues (import) des propriétaires actifs, normalisées à 100.
        SELECT SUM(prevue) INTO v_total FROM (
          SELECT lp.id, COALESCE((
            SELECT NULLIF(e->>'quote_part', '')::numeric
            FROM "invitation" i, jsonb_array_elements(COALESCE(i.pre_rempli_json->'lots', '[]'::jsonb)) e
            WHERE i.copropriete_id = v_inv.copropriete_id AND i.accepte_par_id = lp.utilisateur_id AND (e->>'lot_id')::uuid = lp.lot_id
            ORDER BY i.cree_le DESC LIMIT 1
          ), CASE WHEN lp.id = v_new_lp THEN v_prevue ELSE lp.quote_part END) AS prevue
          FROM "lot_proprietaire" lp WHERE lp.lot_id = v_lot_id AND lp.date_fin IS NULL
        ) t;
        -- Toujours normaliser : un co-indivisaire déjà rattaché porte 100 % tant qu'il est seul.
        IF v_total IS NOT NULL AND v_total > 0 THEN
          v_reste := 100;
          FOR v_row IN
            SELECT lp.id, COALESCE((
              SELECT NULLIF(e->>'quote_part', '')::numeric
              FROM "invitation" i, jsonb_array_elements(COALESCE(i.pre_rempli_json->'lots', '[]'::jsonb)) e
              WHERE i.copropriete_id = v_inv.copropriete_id AND i.accepte_par_id = lp.utilisateur_id AND (e->>'lot_id')::uuid = lp.lot_id
              ORDER BY i.cree_le DESC LIMIT 1
            ), CASE WHEN lp.id = v_new_lp THEN v_prevue ELSE lp.quote_part END) AS prevue
            FROM "lot_proprietaire" lp WHERE lp.lot_id = v_lot_id AND lp.date_fin IS NULL AND lp.id <> v_new_lp
          LOOP
            UPDATE "lot_proprietaire" SET quote_part = ROUND(v_row.prevue * 100 / v_total, 2) WHERE id = v_row.id;
            v_reste := v_reste - ROUND(v_row.prevue * 100 / v_total, 2);
          END LOOP;
          UPDATE "lot_proprietaire" SET quote_part = v_reste WHERE id = v_new_lp;
        END IF;
      END LOOP;
    ELSIF v_inv.role_cible = 'LOCATAIRE' THEN
      FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(v_inv.pre_rempli_json->'lots', '[]'::jsonb)) LOOP
        v_lot_id := (v_elem->>'lot_id')::uuid;
        IF NOT EXISTS (SELECT 1 FROM "lot" WHERE id = v_lot_id AND copropriete_id = v_inv.copropriete_id) THEN CONTINUE; END IF;
        INSERT INTO "lot_occupant" (lot_id, utilisateur_id, type_occupation, date_debut)
        SELECT v_lot_id, p_utilisateur_id, 'LOCATAIRE'::"TypeOccupation", COALESCE(NULLIF(v_elem->>'date_debut', '')::date, CURRENT_DATE)
        WHERE NOT EXISTS (SELECT 1 FROM "lot_occupant" WHERE lot_id = v_lot_id AND utilisateur_id = p_utilisateur_id AND date_fin IS NULL);
      END LOOP;
    ELSIF v_inv.role_cible = 'GARDIEN' AND (v_inv.pre_rempli_json ? 'poste') THEN
      INSERT INTO "personnel" (utilisateur_id, copropriete_id, poste, date_embauche, salaire_brut_mensuel, numero_cnss)
      SELECT p_utilisateur_id, v_inv.copropriete_id,
             COALESCE(NULLIF(v_inv.pre_rempli_json->>'poste', ''), 'GARDIEN')::"PostePersonnel",
             NULLIF(v_inv.pre_rempli_json->>'date_embauche', '')::date,
             NULLIF(v_inv.pre_rempli_json->>'salaire_brut_mensuel', '')::numeric,
             NULLIF(v_inv.pre_rempli_json->>'numero_cnss', '')
      WHERE NOT EXISTS (SELECT 1 FROM "personnel" WHERE utilisateur_id = p_utilisateur_id AND copropriete_id = v_inv.copropriete_id);
    END IF;
  END IF;

  UPDATE "invitation" SET statut = 'ACCEPTEE', accepte_par_id = p_utilisateur_id WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'statut', 'OK',
    'copropriete_id', v_inv.copropriete_id,
    'lot_id', v_inv.lot_id,
    'role', v_inv.role_cible::text,
    'statut_compte', v_statut_compte::text
  );
END;
$$;
