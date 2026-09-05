-- M18 — Transparence : factures des dépenses PAYEE lisibles par les résidents UNIQUEMENT si le
-- syndic a activé `copropriete.factures_visibles_residents` (Doc A §3.5). La policy RLS de
-- `facture` reste syndic / conseil (jamais assouplie) : la lecture résident passe par cette fonction
-- SECURITY DEFINER, bornée à la copropriété courante (set_config), aux dépenses PAYEE et à l'option.
CREATE OR REPLACE FUNCTION public.transparence_factures(p_copropriete_id uuid, p_depense_ids uuid[])
RETURNS TABLE (id uuid, depense_id uuid, numero text, montant_ttc numeric, storage_path text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT f.id, f.depense_id, f.numero, f.montant_ttc, d.storage_path
  FROM facture f
  JOIN depense dep ON dep.id = f.depense_id
  JOIN document d ON d.id = f.document_id
  JOIN copropriete c ON c.id = dep.copropriete_id
  WHERE dep.copropriete_id = p_copropriete_id
    AND p_copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid
    AND dep.statut = 'PAYEE'
    AND c.factures_visibles_residents = true
    AND f.depense_id = ANY (p_depense_ids)
  ORDER BY f.date_facture ASC;
$$;
REVOKE ALL ON FUNCTION public.transparence_factures(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transparence_factures(uuid, uuid[]) TO application_role;

-- Agrégats de niveau copropriété pour la vue de transparence (Doc A §3.5) : les policies RLS de
-- appel_de_fonds_lot / paiement (résident = ses lots) et fonds_reserve* (syndic / conseil) ne sont
-- PAS assouplies — cette fonction SECURITY DEFINER ne renvoie que des SOMMES et des COMPTES sur la
-- copropriété courante (set_config), jamais une ligne, jamais un lot. Mêmes conventions que
-- apps/api/lib/rapports/chiffres.ts (paiement VALIDE par horodatage, dépense PAYEE compte courant,
-- appels non BROUILLON de l'exercice, impayés = lignes IMPAYE / PARTIEL échues).
CREATE OR REPLACE FUNCTION public.transparence_agregats(p_copropriete_id uuid, p_exercice text)
RETURNS TABLE (
  total_entrees numeric, total_sorties_compte_courant numeric,
  reserve numeric, reserve_configuree boolean,
  appele_exercice numeric, encaisse_exercice numeric,
  impayes_total numeric, nb_lots_en_retard integer
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH ok AS (
    SELECT p_copropriete_id = NULLIF(current_setting('app.current_copropriete_id', true), '')::uuid AS autorise
  ),
  lignes AS (
    SELECT l.lot_id, l.montant_du, l.montant_paye, l.statut, a.periode, a.date_echeance
    FROM appel_de_fonds_lot l JOIN appel_de_fonds a ON a.id = l.appel_de_fonds_id
    WHERE a.copropriete_id = p_copropriete_id AND a.statut <> 'BROUILLON'
  )
  SELECT
    COALESCE((SELECT SUM(p.montant) FROM paiement p JOIN lot lo ON lo.id = p.lot_id WHERE lo.copropriete_id = p_copropriete_id AND p.statut = 'VALIDE'), 0),
    COALESCE((SELECT SUM(d.montant_ttc) FROM depense d WHERE d.copropriete_id = p_copropriete_id AND d.statut = 'PAYEE' AND d.source = 'COMPTE_COURANT'), 0),
    COALESCE((SELECT SUM(m.montant) FROM fonds_reserve_mouvement m JOIN fonds_reserve f ON f.id = m.fonds_reserve_id WHERE f.copropriete_id = p_copropriete_id), 0),
    EXISTS (SELECT 1 FROM fonds_reserve f WHERE f.copropriete_id = p_copropriete_id),
    COALESCE((SELECT SUM(montant_du) FROM lignes WHERE periode LIKE p_exercice || '-%'), 0),
    COALESCE((SELECT SUM(montant_paye) FROM lignes WHERE periode LIKE p_exercice || '-%'), 0),
    COALESCE((SELECT SUM(montant_du - montant_paye) FROM lignes WHERE statut IN ('IMPAYE', 'PARTIEL') AND date_echeance < CURRENT_DATE), 0),
    COALESCE((SELECT COUNT(DISTINCT lot_id) FROM lignes WHERE statut IN ('IMPAYE', 'PARTIEL') AND date_echeance < CURRENT_DATE), 0)::integer
  FROM ok WHERE ok.autorise;
$$;
REVOKE ALL ON FUNCTION public.transparence_agregats(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transparence_agregats(uuid, text) TO application_role;
