-- ════════════════════════════════════════════════════════════════════════════
-- M15 (suite) — accès du GESTIONNAIRE_LCD aux lots qu'il gère.
-- Le gestionnaire est scopé aux déclarations où gestionnaire_id = lui ; il doit pouvoir lire la
-- fiche des lots correspondants (libellé, numéro) pour déclarer un séjour. Policy ADDITIVE
-- (permissive, OR avec tenant_isolation) réservée au nouveau rôle : aucune policy existante
-- n'est modifiée ni assouplie pour les autres rôles.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.lcd_lots_du_gestionnaire(p_utilisateur_id uuid)
RETURNS TABLE(lot_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT lot_id FROM "lot_location_courte_duree" WHERE gestionnaire_id = p_utilisateur_id AND date_fin IS NULL;
$$;
REVOKE ALL ON FUNCTION public.lcd_lots_du_gestionnaire FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lcd_lots_du_gestionnaire TO application_role;

CREATE POLICY lcd_gestionnaire_lecture ON "lot"
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'GESTIONNAIRE_LCD'
    AND copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    AND id IN (SELECT lot_id FROM public.lcd_lots_du_gestionnaire(NULLIF(current_setting('app.current_user_id', true), '')::uuid))
  );
