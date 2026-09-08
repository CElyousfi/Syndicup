-- M23 — identifiants des résidents (propriétaires actifs + occupants en cours) d'un lot de la copropriété
-- courante, pour notifier le lot d'un véhicule mal stationné / d'une attribution depuis un contexte gardien
-- (la RLS de lot_proprietaire / lot_occupant ne lui montre rien). SECURITY DEFINER borné au tenant courant ;
-- ne renvoie que des uuid (ni téléphone, ni e-mail — Doc A §12).
CREATE OR REPLACE FUNCTION public.residents_du_lot(p_lot_id uuid)
RETURNS TABLE (utilisateur_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT DISTINCT x.utilisateur_id FROM (
    SELECT lp.utilisateur_id FROM "lot_proprietaire" lp JOIN "lot" l ON l.id = lp.lot_id
    WHERE lp.lot_id = p_lot_id AND lp.date_fin IS NULL
      AND l.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    UNION ALL
    SELECT lo.utilisateur_id FROM "lot_occupant" lo JOIN "lot" l ON l.id = lo.lot_id
    WHERE lo.lot_id = p_lot_id AND lo.date_fin IS NULL
      AND l.copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
  ) x
  WHERE NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.residents_du_lot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.residents_du_lot(uuid) TO application_role;
