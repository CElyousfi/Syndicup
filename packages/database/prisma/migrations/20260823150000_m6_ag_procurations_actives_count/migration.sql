-- ════════════════════════════════════════════════════════════════════════════
-- Fix : la vérification de la limite légale de procurations par mandataire (Doc A §6.5) doit
-- compter TOUTES les procurations actives d'un mandataire sur une AG, pas seulement celles
-- visibles par la policy RLS "tenant_isolation" sur `ag_procuration` (M6) pour l'utilisateur
-- APPELANT (un nouveau mandant n'est ni mandant ni mandataire des procurations déjà existantes
-- d'un tiers, donc RLS les lui cache) — même pattern SECURITY DEFINER que le reste du module.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.ag_procurations_actives_count(p_ag_id uuid, p_mandataire_id uuid)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(*)::bigint FROM "ag_procuration"
  WHERE ag_id = p_ag_id AND mandataire_id = p_mandataire_id AND revoquee_le IS NULL;
$$;

REVOKE ALL ON FUNCTION public.ag_procurations_actives_count FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ag_procurations_actives_count TO application_role;
