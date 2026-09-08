-- M25 — fiche minimale des copropriétés sous mandat (nom, ville, lots) lisible depuis l'espace cabinet
-- (hors contexte copropriété) : uniquement pour les copropriétés d'un cabinet dont l'appelant est membre.
CREATE OR REPLACE FUNCTION public.cabinet_coproprietes_fiche(p_ids uuid[])
RETURNS TABLE (id uuid, nom text, ville text, nb_lots int, est_demo boolean) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT c.id, c.nom, c.ville, c.nb_lots, c.est_demo FROM "copropriete" c
  WHERE c.id = ANY (p_ids) AND EXISTS (
    SELECT 1 FROM "cabinet_copropriete" m WHERE m.copropriete_id = c.id AND public.cabinet_role_courant(m.cabinet_id) IS NOT NULL);
$$;
REVOKE ALL ON FUNCTION public.cabinet_coproprietes_fiche(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cabinet_coproprietes_fiche(uuid[]) TO application_role;
