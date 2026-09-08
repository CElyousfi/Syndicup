-- M25 — fonctions SECURITY DEFINER de l'espace cabinet (hors contexte copropriété) : identités des membres,
-- recherche d'un compte par téléphone / e-mail (ajout d'un membre), création d'une copropriété par le
-- cabinet, fiche publique et marque (PDF) du cabinet mandataire.

-- Identités minimales de comptes (nom, prénom) — jamais téléphone ni e-mail.
CREATE OR REPLACE FUNCTION public.cabinet_identites(p_ids uuid[])
RETURNS TABLE (id uuid, nom text, prenom text) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT u.id, u.nom, u.prenom FROM "utilisateur" u WHERE u.id = ANY (p_ids) AND NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.cabinet_identites(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_identites(uuid[]) TO application_role;

-- Compte existant par id, téléphone (normalisé +212…) ou e-mail — pour ajouter un membre (aucun compte créé).
CREATE OR REPLACE FUNCTION public.cabinet_trouver_utilisateur(p_id uuid, p_telephone text, p_email text)
RETURNS TABLE (id uuid) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT u.id FROM "utilisateur" u
  WHERE NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND ((p_id IS NOT NULL AND u.id = p_id)
      OR (p_telephone IS NOT NULL AND regexp_replace(u.telephone, '[^0-9+]', '', 'g') = regexp_replace(CASE WHEN p_telephone ~ '^0[5-7]' THEN '+212' || substr(p_telephone, 2) ELSE p_telephone END, '[^0-9+]', '', 'g'))
      OR (p_email IS NOT NULL AND lower(u.email) = lower(p_email)))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.cabinet_trouver_utilisateur(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_trouver_utilisateur(uuid, text, text) TO application_role;

-- Copropriété créée directement par un cabinet (admin) : rattachée au cabinet ; le SYNDIC sera le gestionnaire principal (cabinet_appliquer_acces).
CREATE OR REPLACE FUNCTION public.cabinet_creer_copropriete(p_id uuid, p_cabinet_id uuid, p_nom text, p_adresse text, p_ville text, p_type text, p_nb_lots int, p_acteur uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.cabinet_role_courant(p_cabinet_id) NOT IN ('CABINET_ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Réservé à l''administrateur du cabinet.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO "copropriete" (id, nom, adresse, ville, type_residence, nb_lots, cabinet_id, modifie_le)
  VALUES (p_id, p_nom, p_adresse, p_ville, p_type::"TypeResidence", p_nb_lots, p_cabinet_id, now());
  INSERT INTO "audit_log" (copropriete_id, acteur_id, action, entite, entite_id, apres_json)
  VALUES (p_id, p_acteur, 'COPROPRIETE_CREEE', 'copropriete', p_id, jsonb_build_object('nom', p_nom, 'ville', p_ville, 'cabinet_id', p_cabinet_id));
END $$;
REVOKE ALL ON FUNCTION public.cabinet_creer_copropriete(uuid, uuid, text, text, text, text, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_creer_copropriete(uuid, uuid, text, text, text, text, int, uuid) TO application_role;

-- Fiche publique d'un cabinet (lisible depuis une copropriété qui a un mandat proposé / actif).
CREATE OR REPLACE FUNCTION public.cabinet_fiche_publique(p_cabinet_id uuid)
RETURNS TABLE (id uuid, nom text, raison_sociale text, telephone text, email text) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT c.id, c.nom, c.raison_sociale, c.telephone, c.email FROM "cabinet" c
  WHERE c.id = p_cabinet_id AND EXISTS (
    SELECT 1 FROM "cabinet_copropriete" m WHERE m.cabinet_id = c.id AND m.actif = true
      AND m.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid);
$$;
REVOKE ALL ON FUNCTION public.cabinet_fiche_publique(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_fiche_publique(uuid) TO application_role;

-- Marque du cabinet mandataire (mandat ACTIF) pour les PDF de la copropriété courante.
CREATE OR REPLACE FUNCTION public.cabinet_marque(p_copropriete_id uuid)
RETURNS TABLE (nom text, raison_sociale text, logo_storage_path text) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT c.nom, c.raison_sociale, c.logo_storage_path FROM "cabinet" c JOIN "cabinet_copropriete" m ON m.cabinet_id = c.id
  WHERE m.copropriete_id = p_copropriete_id AND m.actif = true AND m.statut = 'ACTIF'
    AND p_copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.cabinet_marque(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_marque(uuid) TO application_role;
