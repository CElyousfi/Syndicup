-- ════════════════════════════════════════════════════════════════════════════
-- Fix : le vote par procuration (Doc A §6.5) lit les tantièmes du lot du MANDANT, pas du
-- mandataire connecté — la policy RLS "tenant_isolation" sur `lot` (M3) cache normalement ce lot
-- au mandataire (il n'en est ni propriétaire ni occupant). Comme pour les autres lookups
-- inter-tables du module AG, on passe par une fonction SECURITY DEFINER (bypass RLS, lecture
-- d'un seul champ non sensible : tantiemes) plutôt que par une lecture directe scoping-dépendante.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lot_tantiemes(p_lot_id uuid)
RETURNS numeric
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT tantiemes FROM "lot" WHERE id = p_lot_id;
$$;

REVOKE ALL ON FUNCTION public.lot_tantiemes FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lot_tantiemes TO application_role;
