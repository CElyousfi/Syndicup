-- ════════════════════════════════════════════════════════════════════════════
-- M10 (suite) — fonction SECURITY DEFINER `residents_actifs_du_lot`.
--
-- Nécessité : quand le GARDIEN enregistre une visite (Doc A §9.2 "notification push au
-- résident"), le service doit identifier les propriétaires/occupants actifs du lot visité. Or
-- les policies RLS de `lot_proprietaire`/`lot_occupant` (migration M3) cachent au gardien les
-- lignes d'autrui — même contournement standard que `lots_proprietaire_de`/`lots_occupant_de`
-- (M3) : lookup ciblé via fonction SECURITY DEFINER, qui n'expose que des utilisateur_id, pas
-- les quotes-parts ni les baux.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.residents_actifs_du_lot(p_lot_id uuid)
RETURNS TABLE(utilisateur_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT utilisateur_id FROM "lot_proprietaire" WHERE lot_id = p_lot_id AND date_fin IS NULL
  UNION
  SELECT utilisateur_id FROM "lot_occupant" WHERE lot_id = p_lot_id AND date_fin IS NULL;
$$;

REVOKE ALL ON FUNCTION public.residents_actifs_du_lot FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.residents_actifs_du_lot TO application_role;
