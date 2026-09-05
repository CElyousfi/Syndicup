-- M17 — preuve de paiement déclarée par un RÉSIDENT : la policy `document` (M9) réserve l'INSERT
-- au syndic. La preuve est écrite par une fonction SECURITY DEFINER appelée par le service
-- justificatifs APRÈS ses propres contrôles (périmètre `<copropriete>/justificatifs/`, lot du
-- déclarant) : visibilité SYNDIC_ONLY, type JUSTIFICATIF_PAIEMENT, créateur = déclarant. Aucune
-- policy existante n'est modifiée ; le résident relit sa preuve via justificatif_preuve_chemin.
CREATE OR REPLACE FUNCTION public.justificatif_attacher_preuve(p_copropriete_id uuid, p_nom text, p_storage_path text, p_cree_par uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_storage_path NOT LIKE p_copropriete_id::text || '/justificatifs/%' THEN
    RAISE EXCEPTION 'CHEMIN_HORS_PERIMETRE' USING ERRCODE = '42501';
  END IF;
  INSERT INTO "document" ("id", "copropriete_id", "type", "nom", "visibilite", "storage_path", "cree_par")
  VALUES (gen_random_uuid(), p_copropriete_id, 'JUSTIFICATIF_PAIEMENT', left(p_nom, 200), 'SYNDIC_ONLY', p_storage_path, p_cree_par)
  RETURNING "id" INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.justificatif_attacher_preuve FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.justificatif_attacher_preuve TO application_role;
