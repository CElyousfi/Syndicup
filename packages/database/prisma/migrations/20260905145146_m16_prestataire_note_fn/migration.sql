-- M16 — évaluation du prestataire par un résident (Doc A §8.3) : la moyenne des notes est
-- recalculée par une fonction SECURITY DEFINER parce que la policy RLS de `prestataire` (M7)
-- ne montre pas la table aux résidents — ils notent l'incident qu'ils ont créé, la fonction met
-- à jour `note_moyenne` sans leur ouvrir la lecture de l'annuaire. Aucune policy existante n'est
-- modifiée.
CREATE OR REPLACE FUNCTION public.prestataire_notes(p_prestataire_id uuid)
RETURNS TABLE(note integer)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT note_prestataire FROM "incident" WHERE assigne_a = p_prestataire_id AND note_prestataire IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.prestataire_recalculer_note(p_prestataire_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moyenne numeric(3,2);
BEGIN
  SELECT ROUND(AVG(note)::numeric, 2) INTO v_moyenne FROM public.prestataire_notes(p_prestataire_id);
  UPDATE "prestataire" SET "note_moyenne" = v_moyenne WHERE "id" = p_prestataire_id;
  RETURN v_moyenne;
END;
$$;

REVOKE ALL ON FUNCTION public.prestataire_notes FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prestataire_recalculer_note FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prestataire_notes TO application_role;
GRANT EXECUTE ON FUNCTION public.prestataire_recalculer_note TO application_role;
