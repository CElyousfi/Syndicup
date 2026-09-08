-- M21 — identités minimales (nom, prénom) des membres du tenant courant, pour afficher l'auteur
-- d'une annonce / d'un commentaire à un résident (la policy utilisateur_visibilite ne lui montre
-- que lui-même). SECURITY DEFINER borné : uniquement des utilisateurs ayant un rôle actif dans la
-- copropriété courante, jamais de téléphone ni d'e-mail (Doc A §12).
CREATE OR REPLACE FUNCTION public.communication_identites(p_ids uuid[])
RETURNS TABLE (id uuid, nom text, prenom text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT u.id, u.nom, u.prenom
  FROM "utilisateur" u
  WHERE u.id = ANY (p_ids)
    AND NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "role_utilisateur" r
      WHERE r.utilisateur_id = u.id
        AND r.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    );
$$;
REVOKE ALL ON FUNCTION public.communication_identites(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.communication_identites(uuid[]) TO application_role;
