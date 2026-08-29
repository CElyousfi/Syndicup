-- M16 — Aperçu public d'une invitation (avant inscription) : nom de la copropriété, rôle
-- visé, expiration et état. SECURITY DEFINER car l'invité n'a pas encore de contexte tenant
-- (même principe qu'invitation_accepter). Ne retourne AUCUNE donnée personnelle et ne
-- révèle pas si un code inconnu "existe presque" : un code introuvable = 'INVALIDE'.
CREATE OR REPLACE FUNCTION public.invitation_apercu(p_code text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv record;
  v_statut text;
BEGIN
  SELECT i.role_cible, i.expire_le, i.statut, c.nom, c.ville
    INTO v_inv
    FROM "invitation" i JOIN "copropriete" c ON c.id = i.copropriete_id
   WHERE i.code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('statut', 'INVALIDE');
  END IF;
  v_statut := v_inv.statut::text;
  IF v_statut = 'EN_ATTENTE' AND v_inv.expire_le < now() THEN
    v_statut := 'EXPIREE';
  END IF;
  RETURN jsonb_build_object(
    'statut', v_statut,
    'copropriete_nom', v_inv.nom,
    'ville', v_inv.ville,
    'role_cible', v_inv.role_cible::text,
    'expire_le', to_char(v_inv.expire_le AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.invitation_apercu(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_apercu(text) TO application_role;
